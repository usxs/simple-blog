/**
 * backend/site.js — 站点展示信息（名称 / 浏览器标题 / 副标题 / 头像字 / 栏目配置）
 *
 * 存放在 data/site.json，由后台「管理」页维护；前端启动时通过 GET /api/site 拉取，
 * 因此改完立刻生效，不需要重新部署前端。
 *
 * 初始值优先级：data/site.json > 环境变量 > 内置默认值。
 *
 * modules 描述前台导航里的每个栏目：
 *   enabled  是否在前台显示（关闭后前台导航隐藏，直接访问会提示已关闭）
 *   name     栏目显示名（可改）
 *   icon     图标：预设名（如 'book'）或以 / 开头的站内图片路径 / http(s) 地址
 */

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./storage');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
const SITE_FILE = path.join(DATA_DIR, 'site.json');

const LIMITS = { name: 40, avatarText: 2, title: 80, subtitle: 200, moduleName: 12, icon: 300 };

// 前台导航栏目（顺序即前台顺序）
const MODULE_KEYS = ['home', 'posts', 'moments', 'tools', 'probe', 'status', 'quirky'];

const PRESET_ICONS = [
  'home', 'book', 'message', 'wrench', 'activity', 'heart', 'star', 'code',
  'camera', 'music', 'globe', 'folder', 'link', 'zap', 'coffee', 'image'
];

const MODULE_DEFAULTS = {
  home: { name: '首页', icon: 'home' },
  posts: { name: '文章', icon: 'book' },
  moments: { name: '碎碎念', icon: 'message' },
  tools: { name: '工具', icon: 'wrench' },
  probe: { name: '探针', icon: 'activity' },
  status: { name: '状态', icon: 'heart' },
  quirky: { name: '奇奇怪怪', icon: 'star' }
};

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

/** 图标值：空 → 预设默认；预设名 / 站内路径 / http(s) 地址都放行，其余丢弃 */
function pickIcon(value, presetDefault) {
  const s = String(value == null ? '' : value).trim().slice(0, LIMITS.icon);
  if (!s) return presetDefault;
  if (PRESET_ICONS.indexOf(s) !== -1) return s;
  if (s.charAt(0) === '/' || /^https?:\/\//i.test(s)) return s;
  return presetDefault;
}

/** 合并存储中的栏目配置与默认值，保证每个 key 都存在 */
function normalizeModules(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  const out = {};
  MODULE_KEYS.forEach((key) => {
    const def = MODULE_DEFAULTS[key];
    const item = src[key] && typeof src[key] === 'object' ? src[key] : {};
    out[key] = {
      enabled: item.enabled === undefined ? true : !!item.enabled,
      name: pickText(item.name, def.name, LIMITS.moduleName),
      icon: pickIcon(item.icon, def.icon)
    };
  });
  return out;
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
    modules: normalizeModules(source.modules),
    updatedAt: Number(source.updatedAt) || 0
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** 保存站点信息：只接受已知字段，逐项裁剪长度；modules 支持部分字段合并 */
function saveSite(patch) {
  const current = getSite();
  const p = patch && typeof patch === 'object' ? patch : {};

  let modules = current.modules;
  if (p.modules && typeof p.modules === 'object') {
    modules = {};
    MODULE_KEYS.forEach((key) => {
      const base = current.modules[key];
      const item = p.modules[key] && typeof p.modules[key] === 'object' ? p.modules[key] : {};
      modules[key] = {
        enabled: item.enabled === undefined ? base.enabled : !!item.enabled,
        name: item.name === undefined ? base.name : pickText(item.name, base.name, LIMITS.moduleName),
        icon: item.icon === undefined ? base.icon : pickIcon(item.icon, base.icon)
      };
    });
  }

  const next = {
    name: pickText(p.name, current.name, LIMITS.name),
    avatarText: pickText(p.avatarText, current.avatarText, LIMITS.avatarText),
    title: pickText(p.title, current.title, LIMITS.title),
    subtitle: pickText(p.subtitle, current.subtitle, LIMITS.subtitle),
    modules,
    updatedAt: Date.now()
  };
  ensureDataDir();
  const tmp = SITE_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o644 });
  fs.renameSync(tmp, SITE_FILE);
  return next;
}

module.exports = {
  getSite,
  saveSite,
  SITE_FILE,
  LIMITS,
  MODULE_KEYS,
  MODULE_DEFAULTS,
  PRESET_ICONS
};

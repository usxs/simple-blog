/**
 * backend/site.js — 站点展示信息（名称 / 浏览器标题 / 副标题 / 头像字 / 栏目配置）
 *
 * 存放在 data/site.json，由后台「管理」页维护；前端启动时通过 GET /api/site 拉取，
 * 因此改完立刻生效，不需要重新部署前端。
 *
 * 初始值优先级：data/site.json > 环境变量 > 内置默认值。
 *
 * probe 描述「探针」页的数据来源：
 *   enabled   是否启用探针页数据（关闭后前台探针页显示未启用）
 *   provider  数据来源：cf（CF-Server-Monitor）/ minimal（极简探针 monitor）
 *   url       数据源地址（cf 取 <url>/api/servers；minimal 取 <url>/api/nodes）
 *   panelUrl  可选，面板/监控后台地址，前台探针页用它显示「打开监控后台」入口
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

const LIMITS = { name: 40, avatarText: 2, title: 80, subtitle: 200, moduleName: 12, icon: 300, route: 24, probeUrl: 300, footerText: 60, footerNote: 120, socialUrl: 200, adminPath: 24 };

// 前台导航栏目（顺序即前台顺序）
const MODULE_KEYS = ['home', 'posts', 'moments', 'links', 'tools', 'probe', 'status', 'quirky'];

const PRESET_ICONS = [
  'home', 'book', 'message', 'wrench', 'activity', 'heart', 'star', 'code',
  'camera', 'music', 'globe', 'folder', 'link', 'zap', 'coffee', 'image'
];

const MODULE_DEFAULTS = {
  home: { name: '首页', icon: 'home', route: '' },
  posts: { name: '文章', icon: 'book', route: 'posts' },
  moments: { name: '碎碎念', icon: 'message', route: 'moments' },
  links: { name: '友链', icon: 'link', route: 'links' },
  tools: { name: '工具', icon: 'wrench', route: 'tools' },
  probe: { name: '探针', icon: 'activity', route: 'probe' },
  status: { name: '状态', icon: 'heart', route: 'status' },
  quirky: { name: '奇奇怪怪', icon: 'star', route: 'quirky' }
};

// 这些一级路径被既有功能占用，不允许给栏目当自定义路由
const RESERVED_ROUTES = [
  'links',
  'post', 'posts', 'admin', 'api', 'img', 'file', 'assets', 'static', 'data',
  'sitemap', 'robots', 'sitemap.xml', 'robots.txt', 'version', 'favicon',
  'index', 'index.html', 'markdown', 'style', 'app', 'functions',
  'moments', 'tools', 'probe', 'status', 'quirky', 'comments', 'login'
];

function normalizeRoute(value, fallback) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) return fallback;
  const cleaned = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(cleaned)) return fallback;
  if (RESERVED_ROUTES.indexOf(cleaned) !== -1) return fallback;
  return cleaned;
}

// 探针数据源：cf = CF-Server-Monitor，minimal = 极简探针（monitor）
const PROBE_PROVIDERS = ['cf', 'minimal'];
const PROBE_LABELS = { cf: 'CF 探针', minimal: '极简探针' };

const PROBE_DEFAULTS = {
  enabled: process.env.PROBE_ENABLED !== '0',
  provider: String(process.env.PROBE_PROVIDER || 'cf').toLowerCase() === 'minimal' ? 'minimal' : 'cf',
  url: String(process.env.PROBE_URL || process.env.PROBE_SERVERS_URL || '').trim(),
  panelUrl: String(process.env.PROBE_PANEL_URL || '').trim()
};

function pickUrl(value) {
  const s = String(value == null ? '' : value).trim().slice(0, LIMITS.probeUrl);
  if (!s) return '';
  return /^https?:\/\/[^\s]+$/i.test(s) ? s.replace(/\/+$/, '') : '';
}

/** 探针配置：来源只能是 cf / minimal，地址必须是 http(s) */
function normalizeProbe(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  const provider = PROBE_PROVIDERS.indexOf(String(src.provider || '').toLowerCase()) !== -1
    ? String(src.provider).toLowerCase()
    : PROBE_DEFAULTS.provider;
  return {
    enabled: src.enabled === undefined ? PROBE_DEFAULTS.enabled : !!src.enabled,
    provider,
    label: PROBE_LABELS[provider],
    url: src.url === undefined ? PROBE_DEFAULTS.url : pickUrl(src.url),
    panelUrl: src.panelUrl === undefined ? PROBE_DEFAULTS.panelUrl : pickUrl(src.panelUrl)
  };
}

// 页脚：ICP / 公安 / 萌 ICP 备案（留空即不显示）+ 一行自定义说明
const FOOTER_DEFAULTS = {
  // 是否显示「© 年份 站名 · All Rights Reserved.」，可用 SITE_COPYRIGHT=0 默认关闭
  copyright: String(process.env.SITE_COPYRIGHT || '1') !== '0',
  icpText: String(process.env.SITE_ICP || '').trim(),
  policeText: String(process.env.SITE_POLICE || '').trim(),
  moeText: String(process.env.SITE_MOE || '').trim(),
  extra: String(process.env.SITE_FOOTER_EXTRA || '').trim()
};

// 首页社交链接（留空即不显示）
const SOCIAL_KEYS = ['github', 'x', 'telegram', 'email'];
const SOCIAL_DEFAULTS = {
  github: String(process.env.SITE_GITHUB || '').trim(),
  x: String(process.env.SITE_X || '').trim(),
  telegram: String(process.env.SITE_TELEGRAM || '').trim(),
  email: String(process.env.SITE_EMAIL || '').trim()
};

/** 可选文本：undefined 用默认值，空串就是空串（允许在后台清空） */
function pickOptional(value, fallback, max) {
  if (value === undefined) return fallback;
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** 社交链接：允许 mailto: 与 http(s)，其余丢弃 */
function pickSocial(value, fallback) {
  const s = pickOptional(value, fallback, LIMITS.socialUrl);
  if (!s) return '';
  if (/^mailto:[^\s]+$/i.test(s)) return s;
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
}

function normalizeFooter(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  return {
    copyright: src.copyright === undefined ? FOOTER_DEFAULTS.copyright : Boolean(src.copyright),
    icpText: pickOptional(src.icpText, FOOTER_DEFAULTS.icpText, LIMITS.footerText),
    policeText: pickOptional(src.policeText, FOOTER_DEFAULTS.policeText, LIMITS.footerText),
    moeText: pickOptional(src.moeText, FOOTER_DEFAULTS.moeText, LIMITS.footerText),
    extra: pickOptional(src.extra, FOOTER_DEFAULTS.extra, LIMITS.footerNote)
  };
}

function normalizeSocials(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  const out = {};
  SOCIAL_KEYS.forEach((key) => { out[key] = pickSocial(src[key], SOCIAL_DEFAULTS[key]); });
  return out;
}

const DEFAULTS = {
  name: process.env.SITE_NAME || '简单博客',
  avatarText: process.env.SITE_AVATAR || '',
  title: process.env.SITE_TITLE || '',
  subtitle: process.env.SITE_SUBTITLE || '这里是我的个人博客，记录技术、折腾与生活。',
  // 后台入口路径（不带斜杠）。改成别的字符串就能藏起来，例如 ADMIN_PATH=dashboard
  adminPath: process.env.ADMIN_PATH || 'admin'
};

// 外部域名白名单：默认值写在代码里，后台可增删；初始化后以 data/site.json 为准
const WHITELIST_DEFAULTS = (process.env.SITE_WHITELIST || [
  'github.com',
  'x.com',
  'twitter.com',
  't.me',
  'telegram.me',
  'gitee.com',
  'beian.miit.gov.cn'
].join(','))
  .split(/[,，\s]+/)
  .map((s) => String(s || '').trim().toLowerCase())
  .filter(Boolean)
  .slice(0, 200);

// 接受数组或逗号/换行分隔字符串；去协议、路径、端口，校验域名格式后去重
function normalizeWhitelist(value) {
  const raw = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[,，\s]+/);
  const seen = Object.create(null);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    let host = String(raw[i] == null ? '' : raw[i]).trim().toLowerCase();
    host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
    if (host.charAt(0) === '.') host = host.slice(1);
    if (!host || host.length > 100) continue;
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) continue;
    if (seen[host]) continue;
    seen[host] = true;
    out.push(host);
    if (out.length >= 200) break;
  }
  return out;
}

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

/** 栏目顺序：只保留已知 key、去重，缺的按默认顺序补在末尾 */
function normalizeOrder(input) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  arr.forEach((k) => {
    const key = String(k == null ? '' : k).trim();
    if (MODULE_KEYS.indexOf(key) !== -1 && out.indexOf(key) === -1) out.push(key);
  });
  MODULE_KEYS.forEach((key) => {
    if (out.indexOf(key) === -1) out.push(key);
  });
  return out;
}

/** 合并存储中的栏目配置与默认值，保证每个 key 都存在 */
// 后台入口路径：小写字母/数字/连字符，2–24 位；不能和前台栏目或保留字撞车
const ADMIN_RESERVED = ['', 'api', 'admin', 'login', 'logout', 'setup', 'post', 'posts',
  'moments', 'links', 'tools', 'probe', 'status', 'quirky', 'img', 'file', 'assets',
  'static', 'data', 'sitemap', 'sitemap.xml', 'robots', 'robots.txt', 'version',
  'favicon', 'favicon.ico', 'index', 'index.html', 'style', 'style.css', 'app', 'app.js',
  'markdown', 'markdown.js', 'functions', 'comments', 'admin.html', 'admin.js', 'admin.css'];

function normalizeAdminPath(value) {
  const fallback = DEFAULTS.adminPath || 'admin';
  const raw = String(value == null ? '' : value).trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!raw) return fallback;
  if (!/^[a-z0-9][a-z0-9-]{1,23}$/.test(raw)) return fallback;
  if (ADMIN_RESERVED.indexOf(raw) !== -1) return fallback;
  return raw;
}

function normalizeModules(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  const out = {};
  const used = [];
  MODULE_KEYS.forEach((key) => {
    const def = MODULE_DEFAULTS[key];
    const item = src[key] && typeof src[key] === 'object' ? src[key] : {};
    let route = key === 'home' ? '' : normalizeRoute(item.route, def.route);
    // 路由不允许重复：撞车时回退到该栏目的默认路由，默认路由也被占用则用 key
    if (key !== 'home' && used.indexOf(route) !== -1) {
      route = used.indexOf(def.route) === -1 ? def.route : key;
    }
    if (key !== 'home') used.push(route);
    out[key] = {
      enabled: item.enabled === undefined ? true : !!item.enabled,
      name: pickText(item.name, def.name, LIMITS.moduleName),
      icon: pickIcon(item.icon, def.icon),
      route
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
    order: normalizeOrder(source.order),
    probe: normalizeProbe(source.probe),
    footer: normalizeFooter(source.footer),
    socials: normalizeSocials(source.socials),
    whitelist: normalizeWhitelist(source.whitelist === undefined ? WHITELIST_DEFAULTS : source.whitelist),
    adminPath: normalizeAdminPath(source.adminPath),
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
        icon: item.icon === undefined ? base.icon : pickIcon(item.icon, base.icon),
        route: key === 'home' || item.route === undefined ? base.route : normalizeRoute(item.route, base.route)
      };
    });
  }

  modules = normalizeModules(modules);
  const order = p.order === undefined ? current.order : normalizeOrder(p.order);

  const currentProbe = current.probe;
  let probe = currentProbe;
  if (p.probe && typeof p.probe === 'object') {
    probe = normalizeProbe({
      enabled: p.probe.enabled === undefined ? currentProbe.enabled : p.probe.enabled,
      provider: p.probe.provider === undefined ? currentProbe.provider : p.probe.provider,
      url: p.probe.url === undefined ? currentProbe.url : p.probe.url,
      panelUrl: p.probe.panelUrl === undefined ? currentProbe.panelUrl : p.probe.panelUrl
    });
  }

  let footer = current.footer;
  if (p.footer && typeof p.footer === 'object') {
    footer = normalizeFooter({
      copyright: p.footer.copyright === undefined ? current.footer.copyright !== false : !!p.footer.copyright,
      icpText: p.footer.icpText === undefined ? current.footer.icpText : p.footer.icpText,
      policeText: p.footer.policeText === undefined ? current.footer.policeText : p.footer.policeText,
      moeText: p.footer.moeText === undefined ? current.footer.moeText : p.footer.moeText,
      extra: p.footer.extra === undefined ? current.footer.extra : p.footer.extra
    });
  }

  let socials = current.socials;
  if (p.socials && typeof p.socials === 'object') {
    socials = normalizeSocials({
      github: p.socials.github === undefined ? current.socials.github : p.socials.github,
      x: p.socials.x === undefined ? current.socials.x : p.socials.x,
      telegram: p.socials.telegram === undefined ? current.socials.telegram : p.socials.telegram,
      email: p.socials.email === undefined ? current.socials.email : p.socials.email
    });
  }

  const next = {
    name: pickText(p.name, current.name, LIMITS.name),
    avatarText: pickText(p.avatarText, current.avatarText, LIMITS.avatarText),
    title: pickText(p.title, current.title, LIMITS.title),
    subtitle: pickText(p.subtitle, current.subtitle, LIMITS.subtitle),
    modules,
    order,
    probe,
    footer,
    socials,
    whitelist: p.whitelist === undefined ? current.whitelist : normalizeWhitelist(p.whitelist),
    adminPath: p.adminPath === undefined ? current.adminPath : normalizeAdminPath(p.adminPath),
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
  normalizeOrder,
  PRESET_ICONS,
  RESERVED_ROUTES,
  normalizeRoute,
  PROBE_PROVIDERS,
  PROBE_LABELS,
  normalizeProbe,
  normalizeAdminPath,
  normalizeWhitelist,
  WHITELIST_DEFAULTS
};

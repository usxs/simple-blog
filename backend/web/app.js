var SITE_CONFIG = {
  name: '简单博客',
  owner: '博主',
  avatarText: '简',
  homeTitle: 'Hi, I am here.',
  homeBio: '这里是我的个人博客，记录技术、折腾与生活。',
  // V3 前后端不分离：接口就在同一个域名下，留空即同源
  apiBaseUrl: '',
  turnstileSiteKey: '',
  whitelistEnabled: true,
  probeUrl: '',
  icpText: '',
  siteStartDate: '2026-01-01',
  socials: {
    github: '',
    x: '',
    telegram: '',
    email: ''
  },
  whitelistDomains: [
    'github.com',
    'x.com',
    'twitter.com',
    't.me',
    'telegram.me',
    'gitee.com',
    'beian.miit.gov.cn'
  ]
};

var ICON_ORDER = ['home', 'book', 'message', 'wrench', 'activity', 'heart', 'star', 'code', 'camera', 'music', 'globe', 'folder', 'link', 'zap', 'coffee', 'image'];

var ICON_SVGS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  book: '<path d="M12 5v16"/><path d="M20 19a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3.5A4.5 4.5 0 0 0 12 5a4.5 4.5 0 0 0-4.5-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4a5 5 0 0 1 4 2 5 5 0 0 1 4-2z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1c.3-.3.9-.2 1 .2a6 6 0 0 1-8.3 7.1l-7.9 7.9a1 1 0 0 1-3-3l7.9-7.9A6 6 0 0 1 17.6 2c.4.1.5.7.2 1z"/>',
  activity: '<path d="M22 12h-2.5a2 2 0 0 0-1.9 1.5l-2.3 8.4a.25.25 0 0 1-.5 0L9.2 2.2a.25.25 0 0 0-.5 0L6.4 10.5A2 2 0 0 1 4.5 12H2"/>',
  heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.6-3.7.56.56 0 0 0 .8 0A5.5 5.5 0 0 1 22 9.5c0 2.3-1.5 4-3 5.5l-5.5 5.3a2 2 0 0 1-3 0L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.2 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
  star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'
};

// ---------------- Cloudflare Turnstile ----------------
// 只有后端 /api/site 下发 siteKey 时才加载；未配置时评论继续使用算术验证码。
var TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (window.__turnstileLoading) return window.__turnstileLoading;
  window.__turnstileLoading = new Promise(function (resolve, reject) {
    var script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = function () {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile 未加载'));
    };
    script.onerror = function () { reject(new Error('Turnstile 加载失败')); };
    document.head.appendChild(script);
  }).catch(function (err) {
    window.__turnstileLoading = null;
    throw err;
  });
  return window.__turnstileLoading;
}

function turnstileTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function renderTurnstile(container, action, onToken) {
  if (!container || !SITE_CONFIG.turnstileSiteKey) return Promise.resolve(null);
  return loadTurnstileScript().then(function (api) {
    if (!api || !container) return null;
    container.hidden = false;
    container.innerHTML = '';
    return api.render(container, {
      sitekey: SITE_CONFIG.turnstileSiteKey,
      action: action,
      theme: turnstileTheme(),
      callback: function (token) { onToken(token || ''); },
      'expired-callback': function () { onToken(''); },
      'error-callback': function () { onToken(''); }
    });
  }).catch(function () {
    container.hidden = true;
    return null;
  });
}

function resetTurnstile(widget) {
  if (widget === null || widget === undefined || !window.turnstile) return;
  try { window.turnstile.reset(widget); } catch (e) { /* 忽略 */ }
}

var ICON_FALLBACK = {
  home: { name: '首页', icon: 'home' },
  posts: { name: '文章', icon: 'book' },
  moments: { name: '瞬间', icon: 'message' },
  tools: { name: '工具', icon: 'wrench' },
  probe: { name: '探针', icon: 'activity' },
  status: { name: '状态', icon: 'heart' },
  quirky: { name: '奇奇怪怪', icon: 'star' }
};

// 前台栏目：后端「管理」页可开关 / 改名 / 换图标，GET /api/site 返回 modules
var MODULE_KEYS = ['home', 'posts', 'moments', 'links', 'tools', 'probe', 'status', 'quirky'];

function normalizeModuleConfig(raw) {
  var out = {};
  MODULE_KEYS.forEach(function (key) {
    var def = ICON_FALLBACK[key] || { name: key, icon: 'star' };
    var item = (raw && raw[key]) || {};
    out[key] = {
      enabled: item.enabled === undefined ? true : !!item.enabled,
      name: String(item.name || def.name).slice(0, 12),
      icon: String(item.icon || def.icon),
      route: String(item.route === undefined ? (key === 'home' ? '' : key) : item.route).replace(/^\/+|\/+$/g, '')
    };
  });
  out.home.enabled = true; // 首页永远保留
  return out;
}

function resolveIconUrl(icon) {
  var s = String(icon || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.charAt(0) === '/') {
    return String(SITE_CONFIG.apiBaseUrl || '').replace(/\/+$/, '') + s;
  }
  return '';
}

// 用预设 svg 或上传的图片替换导航项里的图标节点（保持同样的尺寸与颜色继承）
function setNavIcon(el, icon, fallbackId) {
  if (!el) return;
  var old = el.querySelector('svg, img.nav-icon-img');
  if (!old) return;
  var url = resolveIconUrl(icon);
  var node;
  if (url) {
    node = document.createElement('img');
    node.className = 'nav-icon-img';
    node.alt = '';
    node.loading = 'lazy';
    node.src = url;
  } else {
    var id = ICON_SVGS[icon] ? icon : (ICON_SVGS[fallbackId] ? fallbackId : 'star');
    node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 24 24');
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', '1.8');
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = ICON_SVGS[id];
  }
  old.parentNode.replaceChild(node, old);
}

// 栏目访问路径（可在后台「管理 → 前台栏目」自定义，如把 /moment 改成 /diary）
// 默认路径：瞬间是 moment，其余与栏目 key 一致
var DEFAULT_ROUTES = { moments: 'moment' };
function moduleRoute(key) {
  var cfg = SITE_CONFIG.modules;
  var r = cfg && cfg[key] && cfg[key].route;
  r = String(r || (key === 'home' ? '' : (DEFAULT_ROUTES[key] || key)));
  return r.replace(/^\/+|\/+$/g, '');
}

// 路径段 → 栏目 key（先按自定义路径匹配，再兼容旧的默认路径，保证老链接不失效）
function routeToTab(seg) {
  if (!seg) return null;
  var cfg = SITE_CONFIG.modules || {};
  var keys = typeof MODULE_KEYS !== 'undefined' ? MODULE_KEYS : Object.keys(cfg);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'home') continue;
    if (moduleRoute(key) === seg) return key;
  }
  if (cfg[seg] && seg !== 'home') return seg;
  return null;
}

// 把后端栏目配置应用到侧边栏 / 移动端导航 / 路由守卫
// 栏目顺序：只保留已知 key、去重，缺的按默认顺序补在末尾
function normalizeModuleOrder(raw) {
  var out = [];
  (Array.isArray(raw) ? raw : []).forEach(function (k) {
    var key = String(k || '').trim();
    if (MODULE_KEYS.indexOf(key) !== -1 && out.indexOf(key) === -1) out.push(key);
  });
  MODULE_KEYS.forEach(function (key) {
    if (out.indexOf(key) === -1) out.push(key);
  });
  return out;
}

// 按后台设置调整侧边栏与移动端底栏的先后顺序
// 侧边栏结构是 <li><a data-nav></li>：必须整体移动 li，否则 <a> 被拔走后会留下一排空 li，
// flex 的 gap 会让首个栏目上方多出一行空白
function applyNavOrder(raw) {
  var order = normalizeModuleOrder(raw);
  SITE_CONFIG.moduleOrder = order;
  ['.sidebar-nav', '#mobile-dock'].forEach(function (selector) {
    var box = document.querySelector(selector);
    if (!box) return;
    var items = {};
    Array.prototype.slice.call(box.querySelectorAll('[data-nav]')).forEach(function (el) {
      var node = el;
      if (el.tagName === 'A' && el.parentNode && el.parentNode.tagName === 'LI') node = el.parentNode;
      items[el.getAttribute('data-nav')] = node;
    });
    order.forEach(function (key) {
      if (items[key]) box.appendChild(items[key]);
    });
  });
}

function applySiteModules(raw, order) {
  var cfg = normalizeModuleConfig(raw);
  SITE_CONFIG.modules = cfg;
  if (order) applyNavOrder(order);
  MODULE_KEYS.forEach(function (key) {
    if (key === 'home') return;
    var m = cfg[key];
    var items = document.querySelectorAll('[data-nav="' + key + '"]');
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      // 侧边栏渲染在 <li> 里，li 本身也要隐藏，否则会留下占位的空行
      var wrap = (el.tagName === 'A' && el.parentNode && el.parentNode.tagName === 'LI') ? el.parentNode : el;
      el.hidden = !m.enabled;
      wrap.hidden = !m.enabled;
      var label = el.querySelector('span');
      if (label) label.textContent = m.name;
      else if (el.tagName === 'BUTTON') el.textContent = m.name; // 移动端底栏是纯文字按钮
      setNavIcon(el, m.icon, (ICON_FALLBACK[key] || {}).icon);
      if (el.tagName === 'A') el.setAttribute('href', '/' + moduleRoute(key));
    }
  });
  var homeEl = document.querySelector('[data-nav="home"]');
  if (homeEl && homeEl.tagName === 'A' && homeEl.getAttribute('href') !== '/') homeEl.setAttribute('href', '/');
  // 当前所在栏目已被关闭：直接提示，避免停留在不可达页面
  // 路由对象在本文件后段才声明，用 typeof 保护（首屏 fetch 可能早于 router 定义）
  if (typeof router !== 'undefined' && router.current && router.current !== 'home' && isModuleDisabled(router.current)) {
    router.renderModuleClosed(router.current, true);
  }
}

function isModuleDisabled(tab) {
  var key = tab === 'post' ? 'posts' : tab;
  var cfg = SITE_CONFIG.modules;
  if (!cfg || !cfg[key]) return false;
  if (key === 'home') return false;
  return !cfg[key].enabled;
}

function moduleLabel(tab) {
  var key = tab === 'post' ? 'posts' : tab;
  var cfg = SITE_CONFIG.modules;
  return (cfg && cfg[key] && cfg[key].name) || key;
}


// 推特/X 风格黑白自适应认证对勾徽章
function getVerifiedBadgeSvg() {
  return '<span class="verified-badge" title="站长认证" aria-label="站长认证">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path class="verified-badge-bg" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/>' +
      '<path class="verified-badge-check" d="M8.5 12.5l2.5 2.5 5-5.5"/>' +
    '</svg>' +
  '</span>';
}

function syncAvatarFavicon() {
  var avatarEl = document.getElementById('site-avatar');
  var rawText = avatarEl ? avatarEl.textContent : SITE_CONFIG.avatarText;
  var charText = String(rawText || 'S').trim().slice(0, 2);
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bg = isDark ? '#FFFFFF' : '#18181B';
  var fg = isDark ? '#18181B' : '#F4F4F5';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34">' +
    '<rect width="34" height="34" rx="7" fill="' + bg + '"/>' +
    '<text x="50%" y="53%" dominant-baseline="central" text-anchor="middle" fill="' + fg + '" font-family="monospace" font-weight="600" font-size="18">' +
    charText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    '</text></svg>';
  var link = document.getElementById('dynamic-favicon');
  if (link) {
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
}

// SSR 页自带本页专属标题（文章/列表页由 Functions 注入），普通加载用站点名
document.title = (window.__SSR_META__ && window.__SSR_META__.title)
  ? String(window.__SSR_META__.title)
  : SITE_CONFIG.name;
document.getElementById('site-name').textContent = SITE_CONFIG.name;
document.getElementById('site-avatar').textContent = SITE_CONFIG.avatarText;
document.getElementById('copyright-year').textContent = String(new Date().getFullYear());
document.getElementById('footer-owner').textContent = SITE_CONFIG.owner;
syncAvatarFavicon();

// 运行时拉取后端站点信息（后台「管理」页可随时修改，无需重新部署前端）
// 策略：本地缓存优先（首屏立刻正确、后端不可用也正常），后台再拉最新；
// 只有后端 updatedAt 变化时才重新套用并覆盖缓存。
SITE_CONFIG.siteReady = false;
SITE_CONFIG.siteReadyPromise = null;
SITE_CONFIG.cacheUpdatedAt = 0;

var SITE_CACHE_KEY = 'sp_site_cache_v1';

function readSiteCache() {
  try {
    var raw = window.localStorage.getItem(SITE_CACHE_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || !data.site) return null;
    return data;
  } catch (e) { return null; }
}

function writeSiteCache(site) {
  try {
    window.localStorage.setItem(SITE_CACHE_KEY, JSON.stringify({ site: site, savedAt: Date.now() }));
  } catch (e) { /* 隐私模式/配额满时忽略 */ }
}

// 把后端 /api/site 的站点配置套用到页面（名称/头像/标题/简介/栏目）
function applySitePayload(site) {
  if (!site) return;
  var ssrTitled = Boolean(window.__SSR_META__ && window.__SSR_META__.title);

  SITE_CONFIG.turnstileSiteKey = site.turnstileSiteKey ? String(site.turnstileSiteKey) : '';
  SITE_CONFIG.whitelistEnabled = site.whitelistEnabled !== false;
  if (site.name) {
    SITE_CONFIG.name = String(site.name);
    var nameEl = document.getElementById('site-name');
    if (nameEl) nameEl.textContent = SITE_CONFIG.name;
  }
  if (site.avatarText) {
    SITE_CONFIG.avatarText = String(site.avatarText);
    var avatarEl = document.getElementById('site-avatar');
    if (avatarEl) avatarEl.textContent = SITE_CONFIG.avatarText;
  }
  if (!ssrTitled) {
    document.title = site.title ? String(site.title) : SITE_CONFIG.name;
  }
  if (site.modules) applySiteModules(site.modules, site.order);
  if (site.footer) applyFooter(site.footer);
  if (site.socials) {
    SITE_CONFIG.socials = site.socials;
    refreshHomeSocials();
  }
  var ownerEl = document.getElementById('footer-owner');
  if (ownerEl && site.name) ownerEl.textContent = String(site.name);
  if (site.subtitle) {
    SITE_CONFIG.homeBio = String(site.subtitle);
    var bioEl = document.querySelector('.home-bio');
    if (bioEl) bioEl.textContent = SITE_CONFIG.homeBio;
  }
  syncAvatarFavicon();
}

// 配置到得比首屏晚时，若当前路径只有在新配置下才能识别（例如自定义栏目路径 /diary），
// 重新按地址渲染一次，避免停在首页
function rerouteIfPathNowKnown() {
  try {
    if (typeof router === 'undefined' || !router || router.current !== 'home') return;
    var seg = String(window.location.pathname || '/').split('/').filter(Boolean)[0];
    if (!seg) return;
    var tab = routeToTab(seg);
    if (tab && tab !== 'home') router.applyRoute();
  } catch (e) { /* 路由还没准备好时忽略 */ }
}

// 1) 先同步套用缓存：侧边栏不会闪出已关闭栏目，首屏也不用等网络
var cachedSiteData = readSiteCache();
if (cachedSiteData && cachedSiteData.site) {
  SITE_CONFIG.cacheUpdatedAt = Number(cachedSiteData.site.updatedAt || 0);
  SITE_CONFIG.hasConfig = true;
  applySitePayload(cachedSiteData.site);
}

// 2) 后台拉最新配置；失败就沿用缓存（后端挂了前端照常可用）
(function applyRemoteSiteInfo() {
  var base = String(SITE_CONFIG.apiBaseUrl || '').replace(/\/+$/, '');
  // 前后端不分离时 base 为空，也要拉同源 /api/site（Turnstile siteKey 从这里下发）
  SITE_CONFIG.siteReadyPromise = fetch(base + '/api/site', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.ok || !data.site) return;
      var site = data.site;
      var nextUpdatedAt = Number(site.updatedAt || 0);
      var nextTurnstileKey = site.turnstileSiteKey ? String(site.turnstileSiteKey) : '';
      var changed = !SITE_CONFIG.hasConfig || nextUpdatedAt !== SITE_CONFIG.cacheUpdatedAt ||
        nextTurnstileKey !== (SITE_CONFIG.turnstileSiteKey || '');
      SITE_CONFIG.cacheUpdatedAt = nextUpdatedAt;
      SITE_CONFIG.hasConfig = true;
      if (!changed) return;
      applySitePayload(site);
      writeSiteCache(site);
      rerouteIfPathNowKnown();
    })
    .catch(function () { /* 后端不可达时保持缓存/内置配置 */ })
    .then(function () { SITE_CONFIG.siteReady = true; });
})();

// 部署版本徽标：读取 CF Pages Functions 的 /version（部署 id），悬停显示小弹窗
(function showDeployVersion() {
  var badge = document.getElementById('backend-indicator');
  var tipEl = document.getElementById('deploy-tip');
  if (!badge || !tipEl) return;
  fetch('/version', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.version) return;
      var version = String(data.version);
      var lines = ['部署版本 ' + version];
      if (data.commit) lines.push('提交 ' + String(data.commit).slice(0, 7));
      if (data.branch) lines.push('分支 ' + data.branch);
      tipEl.textContent = lines.join(' · ');
      tipEl.hidden = false;
      badge.setAttribute('data-deploy-version', version);
    })
    .catch(function () { /* 本地直开 / 无 Functions 时静默 */ });
})();

// ---------------- 页脚：备案信息（ICP / 公安 / 萌 ICP） ----------------
var FOOTER_ICONS = {
  icp: '<svg viewBox="0 0 1024 1024" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M511.36 1018.24c190.08-75.52 316.8-183.68 380.16-316.8 81.92-158.72 101.12-341.76 63.36-557.44L511.36 5.12 68.48 150.4c-37.76 209.28-19.2 392.32 56.96 551.04 69.12 133.76 196.48 241.28 385.92 316.8z m-329.6-341.76C112 537.6 93.44 378.88 124.8 194.56l385.92-126.08 385.92 126.08c24.96 183.68 6.4 341.76-63.36 475.52-56.96 113.92-165.12 202.88-323.2 272.64-163.2-63.36-271.36-158.72-328.32-266.24z"/><path d="M252.16 632.96V350.72h53.12v282.24h-53.12zM524.8 528.64l51.2 17.28c-7.68 30.72-21.12 53.12-39.04 69.12-18.56 14.72-41.6 22.4-70.4 22.4-35.2 0-64-12.8-86.4-38.4-22.4-24.96-33.92-60.16-33.92-105.6 0-47.36 11.52-83.84 33.92-109.44 22.4-26.24 52.48-39.04 88.96-39.04 32 0 58.24 10.24 78.72 30.72 12.16 12.16 21.12 29.44 26.88 51.84l-52.48 13.44c-2.56-14.72-9.6-26.24-19.84-34.56-9.6-8.32-21.76-12.8-35.84-12.8-19.84 0-35.2 7.68-48 22.4-12.16 14.72-18.56 39.04-18.56 72.96 0 35.84 6.4 60.8 18.56 76.8 12.16 15.36 27.52 22.4 46.08 22.4 14.08 0 26.24-5.12 36.48-14.72 11.52-8.32 19.2-23.68 23.68-44.8z m96.64 104.32V350.72h85.12c32 0 53.12 1.28 63.36 4.48 14.72 4.48 27.52 13.44 37.76 27.52 9.6 14.08 15.36 32 15.36 55.04 0 17.28-2.56 31.36-8.96 43.52-5.76 12.16-13.44 21.12-22.4 28.16-8.96 7.04-18.56 11.52-27.52 13.44-12.8 2.56-30.72 4.48-55.68 4.48h-33.92v106.88l-53.12-1.28z m53.76-234.88v80h28.8c21.12 0 35.2-1.28 42.24-4.48 7.04-2.56 12.8-7.68 16.64-14.08 4.48-6.4 6.4-13.44 6.4-21.76 0-10.24-2.56-19.2-8.32-24.96-5.76-7.04-12.8-10.24-21.12-12.8-6.4-1.28-19.2-1.92-37.76-1.92h-26.88z"/></svg>',
  police: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4.5 5.4v6.6c0 5.4 7.5 9 7.5 9s7.5-3.6 7.5-9V5.4L12 2z"/><path d="m12 7.4 1.35 2.74 3.02.44-2.18 2.13.51 3.01L12 14.32l-2.7 1.4.51-3.01-2.18-2.13 3.02-.44L12 7.4z"/></svg>',
  moe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/></svg>'
};

function footerDigits(text) {
  return String(text || '').replace(/[^0-9]/g, '');
}

// 备案号 → 官方查询链接（ICP 走工信部，公安走网安备案查询，萌 ICP 走 icp.gov.moe）
function footerBadges(footer) {
  var f = footer || {};
  var out = [];
  if (f.icpText) {
    out.push({ kind: 'icp', text: String(f.icpText), href: 'https://beian.miit.gov.cn/' });
  }
  if (f.policeText) {
    var policeCode = footerDigits(f.policeText);
    out.push({
      kind: 'police',
      text: String(f.policeText),
      href: policeCode
        ? 'https://beian.mps.gov.cn/#/query/webSearch?code=' + encodeURIComponent(policeCode)
        : 'https://beian.mps.gov.cn/'
    });
  }
  if (f.moeText) {
    var moeCode = footerDigits(f.moeText);
    out.push({
      kind: 'moe',
      text: String(f.moeText),
      href: moeCode
        ? 'https://icp.gov.moe/?keyword=' + encodeURIComponent(moeCode)
        : 'https://icp.gov.moe/'
    });
  }
  return out;
}

function applyFooter(footer) {
  var f = footer || {};
  var host = document.getElementById('footer-badges');
  var extra = document.getElementById('footer-extra');
  var meta = document.getElementById('footer-meta');
  if (meta) meta.hidden = f.copyright === false;
  if (host) {
    var badges = footerBadges(f);
    host.innerHTML = badges.map(function (b) {
      return '<a class="footer-badge" href="' + escapeHtml(b.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escapeHtml(b.text) + '">' +
        '<span class="footer-badge-icon">' + FOOTER_ICONS[b.kind] + '</span>' +
        '<span class="footer-badge-tip" role="tooltip">' + escapeHtml(b.text) + '</span></a>';
    }).join('');
    host.hidden = !badges.length;
  }
  if (extra) {
    if (f.extra) {
      extra.textContent = String(f.extra);
      extra.hidden = false;
    } else {
      extra.textContent = '';
      extra.hidden = true;
    }
  }
}

applyFooter(SITE_CONFIG.footer);

// 回到顶部：内容超过一屏时在右下角出现
(function () {
  var btn = document.getElementById('back-to-top');
  if (!btn) return;
  var raf = null;
  function update() {
    raf = null;
    var scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
    var extra = document.documentElement.scrollHeight - window.innerHeight;
    var show = scrolled > 260 && extra > 220;
    btn.setAttribute('data-show', show ? 'true' : 'false');
  }
  function schedule() {
    if (raf) return;
    raf = window.requestAnimationFrame ? window.requestAnimationFrame(update) : setTimeout(update, 60);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  var host = document.getElementById('page-content');
  if (host && window.MutationObserver) {
    new MutationObserver(function () { setTimeout(schedule, 80); }).observe(host, { childList: true, subtree: true });
  }
  window.__refreshBackToTop = schedule;
  setTimeout(schedule, 120);
})();

// 把条目的 date 字段解析为可比毫秒数（北京时间锚定）；解析失败回退 mtime
function dateMsOf(item) {
  var raw = String((item && item.date) || '').trim();
  if (raw) {
    var iso = raw.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      iso += 'T00:00:00+08:00';                                  // 纯日期按北京时间零点
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(iso)) {
      iso += '+08:00';                                           // 无时区的日期时间按北京时间
    }
    var ms = Date.parse(iso);
    if (!isNaN(ms)) return ms;
  }
  return Number(item && item.mtime) || 0;
}

// 统一排序：发布日期（date）优先从新到旧，其次 mtime，最后 id
function sortNewestFirst(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().sort(function (a, b) {
    var ta = dateMsOf(a);
    var tb = dateMsOf(b);
    if (tb !== ta) return tb - ta;
    var ma = Number(a && a.mtime) || 0;
    var mb = Number(b && b.mtime) || 0;
    if (mb !== ma) return mb - ma;
    return String((b && b.id) || '').localeCompare(String((a && a.id) || ''));
  });
}

function sortOldestFirst(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().sort(function (a, b) {
    var ta = Number(a && a.mtime) || 0;
    var tb = Number(b && b.mtime) || 0;
    if (ta !== tb) return ta - tb;
    var da = String((a && a.date) || '');
    var db = String((b && b.date) || '');
    return da.localeCompare(db);
  });
}

var linkGuard = {
  pendingUrl: '',
  isWhitelisted: function (urlString) {
    if (SITE_CONFIG.whitelistEnabled === false) return true;
    try {
      if (urlString.indexOf('mailto:') === 0) return true;
      var targetUrl = new URL(urlString, window.location.origin);
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return true;
      }
      var host = targetUrl.hostname.toLowerCase();
      var currentHost = window.location.hostname.toLowerCase();
      if (!host || host === currentHost || host === 'localhost' || host === '127.0.0.1') {
        return true;
      }
      var list = SITE_CONFIG.whitelistDomains || [];
      for (var i = 0; i < list.length; i++) {
        var d = String(list[i]).toLowerCase().trim();
        if (d && (host === d || host.slice(-(d.length + 1)) === '.' + d)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      return true;
    }
  },
  openModal: function (url) {
    this.pendingUrl = url;
    document.getElementById('ext-modal-url').textContent = url;
    document.getElementById('ext-modal').setAttribute('data-open', 'true');
  },
  close: function () {
    this.pendingUrl = '';
    document.getElementById('ext-modal').setAttribute('data-open', 'false');
  },
  confirm: function () {
    var url = this.pendingUrl;
    this.close();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },
  init: function () {
    var self = this;
    document.addEventListener('click', function (e) {
      var anchor = e.target.closest ? e.target.closest('a[href]') : null;
      if (!anchor) return;
      var rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.indexOf('#') === 0 || rawHref.indexOf('javascript:') === 0 || rawHref.indexOf('mailto:') === 0) return;
      if (!self.isWhitelisted(rawHref)) {
        e.preventDefault();
        e.stopPropagation();
        var resolvedUrl = new URL(rawHref, window.location.origin).href;
        self.openModal(resolvedUrl);
      }
    });
    document.getElementById('ext-modal').addEventListener('click', function (e) {
      if (e.target.id === 'ext-modal') self.close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.close();
    });
  }
};
linkGuard.init();

var theme = {
  init: function () {
    var self = this;
    var mode = localStorage.getItem('site-theme-mode') || 'auto';
    this.updateButtons(mode);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      if ((localStorage.getItem('site-theme-mode') || 'auto') === 'auto') {
        self.set('auto');
      }
    });
  },
  set: function (mode) {
    localStorage.setItem('site-theme-mode', mode);
    var isLight = mode === 'light' ? true : (mode === 'dark' ? false : window.matchMedia('(prefers-color-scheme: light)').matches);
    var resolved = isLight ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.style.colorScheme = resolved;
    this.updateButtons(mode);
    syncAvatarFavicon();
  },
  updateButtons: function (mode) {
    var btns = document.querySelectorAll('.theme-option');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-mode') === mode ? 'true' : 'false');
    }
  }
};
theme.init();

var syncClient = {
  setIndicator: function (status, label) {
    var el = document.getElementById('backend-indicator');
    var txt = document.getElementById('backend-indicator-text');
    if (el && txt) {
      el.setAttribute('data-backend-status', status);
      txt.textContent = label;
    }
  },
  getCache: function (moduleName) {
    try {
      var raw = localStorage.getItem('cache_v1_' + moduleName);
      return raw ? JSON.parse(raw) : { version: '', data: [] };
    } catch (e) {
      return { version: '', data: [] };
    }
  },
  setCache: function (moduleName, version, data) {
    try {
      localStorage.setItem('cache_v1_' + moduleName, JSON.stringify({ version: version, data: data }));
    } catch (e) {}
  },
  pingBackend: async function () {
    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var url = base + '/api/sync?module=posts&version=&_t=' + Date.now();
      var res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var payload = await res.json();
      if (payload && Array.isArray(payload.data)) {
        this.setCache('posts', payload.version || String(Date.now()), payload.data);
      }
      this.setIndicator('online', 'ONLINE');
    } catch (e) {
      this.setIndicator('offline', 'OFFLINE');
    }
  },
  // 列表接口只返回摘要，正文按需从公开单篇端点取
  fetchPost: async function (id) {
    var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
    var res = await fetch(base + '/api/public/post/' + encodeURIComponent(String(id)) + '?_t=' + Date.now(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      var err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    var payload = await res.json();
    if (!payload || !payload.post) throw new Error('empty post');
    return payload.post;
  },
  fetchModule: async function (moduleName) {
    var cached = this.getCache(moduleName);
    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var url = base + '/api/sync?module=' + encodeURIComponent(moduleName) + '&version=' + encodeURIComponent(cached.version) + '&_t=' + Date.now();
      var res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var payload = await res.json();
      this.setIndicator('online', payload.updated ? 'ONLINE · 200' : 'ONLINE · 304');
      if (payload.updated && Array.isArray(payload.data)) {
        this.setCache(moduleName, payload.version || String(Date.now()), payload.data);
        return payload.data;
      }
      if (Array.isArray(payload.data) && !cached.data.length) {
        this.setCache(moduleName, payload.version || String(Date.now()), payload.data);
        return payload.data;
      }
      return cached.data;
    } catch (err) {
      this.setIndicator('offline', cached.data.length ? 'OFFLINE · CACHE' : 'OFFLINE');
      return cached.data;
    }
  }
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatProbeSpeed(value) {
  var bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '--';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
  return Math.round(bytes) + ' B/s';
}

function extractFirstLine(md) {
  if (!md) return '';
  var rawLines = String(md).split('\n');
  for (var i = 0; i < rawLines.length; i++) {
    var l = rawLines[i].trim();
    if (l && l.indexOf('#') !== 0 && l.indexOf('```') !== 0 && l.indexOf('![') !== 0) {
      return l.replace(/[*_~>-]/g, '').slice(0, 120);
    }
  }
  return '';
}

function renderHomeSocials() {
  var s = SITE_CONFIG.socials || {};
  // 只渲染配置了真实地址的社交链接；全部未配置时隐藏整行，避免 href="#" 死按钮
  var items = [];
  if (s.github) {
    items.push('<a class="social-link" href="' + escapeHtml(s.github) + '" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>' +
    '</a>');
  }
  if (s.x) {
    items.push('<a class="social-link" href="' + escapeHtml(s.x) + '" target="_blank" rel="noopener noreferrer" title="X (Twitter)" aria-label="X">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
    '</a>');
  }
  if (s.telegram) {
    items.push('<a class="social-link" href="' + escapeHtml(s.telegram) + '" target="_blank" rel="noopener noreferrer" title="Telegram" aria-label="Telegram">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>' +
    '</a>');
  }
  if (s.email) {
    var emailHref = s.email.indexOf('mailto:') === 0 ? s.email : ('mailto:' + s.email);
    items.push('<a class="social-link" href="' + escapeHtml(emailHref) + '" title="Email" aria-label="Email">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
    '</a>');
  }
  return '<div class="home-socials"' + (items.length ? '' : ' hidden') + '>' + items.join('') + '</div>';
}

// 站点配置晚于首页渲染时，就地更新社交链接（不重绘整个首页）
function refreshHomeSocials() {
  var host = document.querySelector('.home-socials');
  if (!host) return;
  var html = renderHomeSocials();
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var next = tmp.firstElementChild;
  if (!next) return;
  host.innerHTML = next.innerHTML;
  host.hidden = next.hidden;
}

var commentBox = {
  currentPostId: '',
  captchaToken: '',
  turnstileWidget: null,
  turnstileToken: '',
  turnstileLoading: null,
  replyToId: '',
  replyToAuthor: '',
  commentsMap: {},

  loadSection: async function (postId) {
    this.currentPostId = String(postId);
    this.cancelReply();
    await Promise.all([
      this.refreshCaptcha(),
      this.loadApprovedComments(postId)
    ]);
  },

  setReplyTo: function (commentId, authorName) {
    this.replyToId = String(commentId || '');
    this.replyToAuthor = String(authorName || '匿名访客');
    var banner = document.getElementById('replying-banner');
    var targetTxt = document.getElementById('replying-target-name');
    var textarea = document.getElementById('comment-content');
    if (banner && targetTxt) {
      targetTxt.textContent = '@' + this.replyToAuthor;
      banner.setAttribute('data-active', 'true');
    }
    if (textarea) {
      textarea.placeholder = '回复 @' + this.replyToAuthor + ' （审核通过后显示在对方评论下方）... *';
      textarea.focus();
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  cancelReply: function () {
    this.replyToId = '';
    this.replyToAuthor = '';
    var banner = document.getElementById('replying-banner');
    var textarea = document.getElementById('comment-content');
    if (banner) {
      banner.setAttribute('data-active', 'false');
    }
    if (textarea) {
      textarea.placeholder = '写下您的想法... *';
    }
  },

  setupTurnstile: async function () {
    if (!SITE_CONFIG.turnstileSiteKey) return;
    var slot = document.getElementById('comment-turnstile');
    if (!slot) return;
    if (this.turnstileWidget !== null) {
      resetTurnstile(this.turnstileWidget);
      this.turnstileToken = '';
      return;
    }
    if (this.turnstileLoading) return this.turnstileLoading;
    var self = this;
    this.turnstileLoading = renderTurnstile(slot, 'comment', function (token) {
      self.turnstileToken = token;
    }).then(function (widget) {
      self.turnstileWidget = widget;
      self.turnstileLoading = null;
      if (widget === null) {
        var msgEl = document.getElementById('comment-feedback');
        if (msgEl) msgEl.textContent = '人机验证加载失败，请刷新页面后重试';
      }
      return widget;
    });
    return this.turnstileLoading;
  },

  resetTurnstile: function () {
    resetTurnstile(this.turnstileWidget);
    this.turnstileToken = '';
  },

  refreshCaptcha: async function () {
    var captchaBox = document.querySelector('#comment-form-box .captcha-box');
    if (SITE_CONFIG.turnstileSiteKey) {
      if (captchaBox) captchaBox.hidden = true;
      await this.setupTurnstile();
      return;
    }
    if (captchaBox) captchaBox.hidden = false;
    var qEl = document.getElementById('captcha-question');
    if (!qEl) return;
    if (this.captchaBusy) return;                                 // 防止连点刷题
    var waitMs = Number(this.captchaCooldownUntil || 0) - Date.now();
    if (waitMs > 0) {
      qEl.textContent = '请等待 ' + Math.ceil(waitMs / 1000) + ' 秒后再换题';
      return;
    }
    this.captchaBusy = true;
    qEl.setAttribute('data-busy', 'true');
    qEl.textContent = '加载中...';
    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var res = await fetch(base + '/api/captcha?_t=' + Date.now(), { cache: 'no-store' });
      if (res.status === 429) {
        var limited = null;
        try { limited = await res.json(); } catch (e2) {}
        var retry = Number((limited && limited.retryAfter) || 60);
        this.captchaCooldownUntil = Date.now() + retry * 1000;
        qEl.textContent = '换题太频繁，请 ' + retry + ' 秒后再试';
        return;
      }
      if (!res.ok) throw new Error('Failed');
      var data = await res.json();
      this.captchaToken = data.token || '';
      qEl.textContent = (data.question || '? + ? =') + ' (点击换一题)';
    } catch (e) {
      qEl.textContent = '验证码加载失败，点击重试';
    } finally {
      this.captchaBusy = false;
      qEl.removeAttribute('data-busy');
    }
  },

  // 被限流后禁用提交按钮并倒计时，避免用户一直点
  startSubmitCooldown: function (seconds) {
    var btnEl = document.getElementById('comment-submit-btn');
    var msgEl = document.getElementById('comment-feedback');
    if (!btnEl) return;
    var left = Math.max(1, Math.ceil(Number(seconds) || 30));
    var self = this;
    btnEl.disabled = true;
    if (this.submitCooldownTimer) clearInterval(this.submitCooldownTimer);
    var tick = function () {
      if (left <= 0) {
        clearInterval(self.submitCooldownTimer);
        self.submitCooldownTimer = null;
        btnEl.disabled = false;
        btnEl.textContent = '发送评论';
        if (msgEl) msgEl.textContent = '';
        return;
      }
      btnEl.textContent = '请等待 ' + left + ' 秒';
      left -= 1;
    };
    tick();
    this.submitCooldownTimer = setInterval(tick, 1000);
  },

  renderNodeRecursive: function (node, childrenMap, isChildLevel) {
    var self = this;
    var authorName = node.author || '匿名访客';
    var replyBadge = '';
    if (node.parentAuthor) {
      replyBadge = '<span class="comment-reply-to">回复 <strong>@' + escapeHtml(node.parentAuthor) + '</strong></span>';
    }

    // 站长针对当前评论的直接回复（作为缩进子块展示，带黑白认证对勾，同样可被继续回复）
    var adminReplyBlockHtml = '';
    if (node.replyContent) {
      var rName = node.replyAuthor || SITE_CONFIG.owner || '博主';
      adminReplyBlockHtml =
        '<li class="comment-admin-reply">' +
          '<div class="comment-item-meta">' +
            '<div class="comment-author-wrap">' +
              '<span class="comment-author">' +
                escapeHtml(rName) +
                getVerifiedBadgeSvg() +
              '</span>' +
              '<span class="comment-reply-to">回复 <strong>@' + escapeHtml(authorName) + '</strong></span>' +
            '</div>' +
            '<div class="comment-meta-right">' +
              '<time class="comment-date">' + escapeHtml(node.replyDate || '') + '</time>' +
              '<button type="button" class="comment-reply-btn" onclick="commentBox.setReplyTo(\'' + escapeHtml(node.id) + '\', \'' + escapeHtml(rName) + '\')">回复</button>' +
            '</div>' +
          '</div>' +
          '<div class="comment-body">' + escapeHtml(node.replyContent) + '</div>' +
        '</li>';
    }

    // 递归渲染层中层子评论
    var childNodes = sortOldestFirst(childrenMap[node.id] || []);
    var childItemsHtml = '';
    for (var i = 0; i < childNodes.length; i++) {
      childItemsHtml += self.renderNodeRecursive(childNodes[i], childrenMap, true);
    }

    var combinedChildrenHtml = '';
    if (adminReplyBlockHtml || childItemsHtml) {
      combinedChildrenHtml =
        '<ul class="comment-children">' +
          adminReplyBlockHtml +
          childItemsHtml +
        '</ul>';
    }

    var itemClass = isChildLevel ? 'comment-child-item' : 'comment-item';
    var authorBadge = node.isAdmin ? getVerifiedBadgeSvg() : '';

    return '<li class="' + itemClass + '" id="comment-' + escapeHtml(node.id) + '">' +
      '<div class="comment-item-meta">' +
        '<div class="comment-author-wrap">' +
          '<span class="comment-author">' + escapeHtml(authorName) + authorBadge + '</span>' +
          replyBadge +
        '</div>' +
        '<div class="comment-meta-right">' +
          '<time class="comment-date">' + escapeHtml(node.date || '') + '</time>' +
          '<button type="button" class="comment-reply-btn" onclick="commentBox.setReplyTo(\'' + escapeHtml(node.id) + '\', \'' + escapeHtml(authorName) + '\')">回复</button>' +
        '</div>' +
      '</div>' +
      '<div class="comment-body">' + escapeHtml(node.content || '') + '</div>' +
      combinedChildrenHtml +
    '</li>';
  },

  loadApprovedComments: async function (postId) {
    var listEl = document.getElementById('comment-list');
    if (!listEl) return;
    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var res = await fetch(base + '/api/comments?postId=' + encodeURIComponent(postId) + '&_t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      var data = await res.json();
      var items = Array.isArray(data.data) ? data.data : [];
      if (!items.length) {
        listEl.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:12px 0;">暂无评论，欢迎留下第一条评论（审核通过后显示）。</li>';
        return;
      }

      var idMap = {};
      for (var i = 0; i < items.length; i++) {
        idMap[items[i].id] = items[i];
      }
      this.commentsMap = idMap;

      var roots = [];
      var childrenMap = {};

      for (var j = 0; j < items.length; j++) {
        var c = items[j];
        var pid = c.parentId || '';
        if (pid && idMap[pid]) {
          if (!c.parentAuthor) {
            c.parentAuthor = idMap[pid].author || '匿名访客';
          }
          if (!childrenMap[pid]) childrenMap[pid] = [];
          childrenMap[pid].push(c);
        } else {
          roots.push(c);
        }
      }

      roots = sortNewestFirst(roots);
      var html = '';
      for (var k = 0; k < roots.length; k++) {
        html += this.renderNodeRecursive(roots[k], childrenMap, false);
      }
      listEl.innerHTML = html;
    } catch (e) {
      listEl.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:12px 0;">评论加载失败。</li>';
    }
  },

  submit: async function () {
    if (this.submitting) return;                                  // 防连点重复提交
    var authorEl = document.getElementById('comment-author');
    var contactEl = document.getElementById('comment-contact');
    var contentEl = document.getElementById('comment-content');
    var answerEl = document.getElementById('captcha-answer');
    var hpEl = document.getElementById('comment-hp');
    var turnstileEnabled = Boolean(SITE_CONFIG.turnstileSiteKey);
    var btnEl = document.getElementById('comment-submit-btn');
    var msgEl = document.getElementById('comment-feedback');

    var author = authorEl ? authorEl.value.trim() : '';
    var contact = contactEl ? contactEl.value.trim() : '';
    var content = contentEl ? contentEl.value.trim() : '';
    var answer = answerEl ? answerEl.value.trim() : '';
    var honeypot = hpEl ? hpEl.value : '';

    if (!author || !content) {
      msgEl.textContent = '请填写昵称和评论内容';
      return;
    }
    if (turnstileEnabled) {
      if (!this.turnstileToken) {
        msgEl.textContent = '请先完成人机验证';
        return;
      }
    } else if (!answer) {
      msgEl.textContent = '请填写算术题计算结果';
      return;
    }

    this.submitting = true;
    btnEl.disabled = true;
    msgEl.textContent = '正在提交...';

    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var res = await fetch(base + '/api/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: this.currentPostId,
          parentId: this.replyToId || '',
          parentAuthor: this.replyToAuthor || '',
          author: author,
          contact: contact,
          content: content,
          captchaToken: this.captchaToken,
          captchaAnswer: answer,
          turnstileToken: this.turnstileToken,
          website_hp: honeypot
        })
      });
      var resData = await res.json();
      if (!res.ok || !resData.ok) {
        msgEl.textContent = resData.error || '提交失败，请重试';
        btnEl.disabled = false;
        // 被限流：按后端给的 retryAfter 倒计时，期间不允许再点
        if (res.status === 429 && resData.retryAfter) {
          this.startSubmitCooldown(resData.retryAfter);
        }
        if (turnstileEnabled) this.resetTurnstile();
        if (res.status !== 429) this.refreshCaptcha();
        if (answerEl) answerEl.value = '';
        return;
      }

      msgEl.textContent = this.replyToId
        ? '回复已提交！待站长后台审核通过后即可展示在对应评论下方。'
        : '评论已提交！待站长后台审核通过后即可展示。';
      if (contentEl) contentEl.value = '';
      if (answerEl) answerEl.value = '';
      this.cancelReply();
      btnEl.disabled = false;
      this.refreshCaptcha();
    } catch (err) {
      msgEl.textContent = '网络错误，请稍后再试';
      btnEl.disabled = false;
    } finally {
      this.submitting = false;
    }
  }
};

var router = {
  current: 'home',
  signatures: {},
  searchQuery: '',
  activeTag: '',
  cachedPosts: [],
  probeRefreshTimer: null,
  probeRequestId: 0,

  // ---------- 真实路径路由：每个页面 / 每篇文章拥有独立、可抓取、可分享的地址 ----------
  // 支持：/  /posts  /moments  /tools  /probe  /status  /quirky  /post/<id>
  // 服务端（CF Pages Functions）会对这些路径返回预渲染 HTML，本文件负责接管交互（水合）。
  KNOWN_TABS: ['home', 'posts', 'moments', 'links', 'links-apply', 'tools', 'probe', 'status', 'quirky'],

  parseRoute: function () {
    var p = '/';
    try {
      p = decodeURIComponent(window.location.pathname || '/');
    } catch (e) {
      p = '/';
    }
    var seg = p.replace(/^\/+|\/+$/g, '').split('/');
    if (seg[0] === 'post' && seg[1]) {
      return { tab: 'post', postId: seg.slice(1).join('/') };
    }
    if (seg[0] === 'links' && seg[1] === 'apply') {
      return { tab: 'links-apply' };
    }
    var tab = routeToTab(seg[0]);
    if (tab) return { tab: tab };
    return { tab: 'home' };
  },

  // 程序化跳转：pushState 更新地址栏（不会触发 popstate，无需加锁）
  syncUrl: function (pathStr) {
    if (window.location.pathname === pathStr) return;
    try {
      window.history.pushState(null, '', pathStr);
    } catch (e) {}
  },

  // 依据当前地址渲染对应视图（浏览器前进/后退、直达链接均走这里）
  applyRoute: async function () {
    // 兼容旧 hash 深链：#/posts → /posts，#/post/<id> → /post/<id>，#/home → /
    var legacy = (window.location.hash || '');
    if (legacy && legacy !== '#') {
      var inner = legacy.replace(/^#\/?/, '').replace(/^\/+|\/+$/g, '');
      if (inner === 'home') {
        try { window.history.replaceState(null, '', '/'); } catch (e) {}
      } else if (inner) {
        try { window.history.replaceState(null, '', '/' + inner); } catch (e) {}
      }
    }
    var r = this.parseRoute();
    if (r.tab === 'post') await this.waitSiteReady();
    if (r.tab === 'post' && isModuleDisabled('post')) {
      this.renderModuleClosed('post', true);
      return;
    }
    if (r.tab === 'post') {
      await this.renderPostRoute(r.postId);
      return;
    }
    // 根路径首次进入：静默渲染首页，不额外改写地址栏
    await this.go(r.tab, window.location.pathname === '/');
  },

  // /post/<id> 路由：SSR 预渲染页直接水合（正文已在 HTML 中，评论仍由前端加载），否则常规渲染
  // 底部移动端导航高亮：文章详情页归属「文章」，避免停在旧的 tab 上
  syncDock: function (tab) {
    var navEls = document.querySelectorAll('[data-nav]');
    var active = tab === 'post' ? 'posts' : tab;
    for (var i = 0; i < navEls.length; i++) {
      if (navEls[i].getAttribute('data-nav') === active) {
        navEls[i].setAttribute('aria-current', 'page');
      } else {
        navEls[i].removeAttribute('aria-current');
      }
    }
    if (typeof window.__refreshDock === 'function') window.__refreshDock();
  },

  renderPostRoute: async function (id) {
    // 不再直接信任 SSR 直出的正文：隐藏/加密状态必须每次回源确认，
    // 否则边缘缓存里的一份旧 HTML 会让已隐藏的文章继续可读。
    await this.renderPost(id);
  },

  // 主题一致的状态页：SPA 内遇到 404/401/403/500 时复用 status.css
  renderStatusPage: function (code, message) {
    var codeNum = Number(code) || 500;
    var map = {
      401: { title: '需要验证身份', text: '这个页面需要验证身份后才能访问。', note: '如果你是从旧链接进入，请先回到首页重新打开。' },
      403: { title: '没有访问权限', text: '当前身份没有访问这个页面的权限。', note: '如果这是你自己的内容，请确认链接是否仍然有效。' },
      404: { title: '页面走丢了', text: '这条链接指向的内容不存在，或者已经被作者隐藏。', note: '它可能已经被移动、删除，或者从来就没有存在过。' },
      500: { title: '服务暂时不可用', text: '服务暂时不可用，请稍后再试。', note: '你的网络看起来正常，问题出在站点这一侧。' }
    };
    var info = map[codeNum] || map[500];
    var desc = message ? String(message) : info.text;
    this.current = 'status';
    this.syncDock('');
    var container = document.getElementById('page-content');
    if (!container) return;
    container.classList.remove('is-reading');
    container.innerHTML =
      '<section class="status-page status-screen" role="alert">' +
        '<div class="status-card">' +
          '<p class="status-kicker">ERROR ' + codeNum + '</p>' +
          '<h1 class="status-title">' + escapeHtml(info.title) + '</h1>' +
          '<p class="status-desc">' + escapeHtml(desc) + '</p>' +
          '<div class="status-actions">' +
            '<a class="status-btn status-btn--primary" href="/">回到首页</a>' +
            '<button class="status-btn" type="button" onclick="if (history.length > 1) history.back(); else location.href=\'/\';">返回上一页</button>' +
          '</div>' +
          '<p class="status-note">' + escapeHtml(info.note) + '</p>' +
        '</div>' +
      '</section>';
    document.title = codeNum + ' · ' + SITE_CONFIG.name;
    window.scrollTo(0, 0);
  },

  // 栏目被站长关闭时的占位页（不报 404，保持地址可访问）
  renderModuleClosed: function (tab, skipUrl) {
    this.current = tab;
    if (!skipUrl && tab !== 'post') this.syncUrl('/' + moduleRoute(tab));
    var container = document.getElementById('page-content');
    container.classList.remove('is-reading');
    var label = moduleLabel(tab);
    container.innerHTML =
      '<section class="module-closed">' +
        '<h1 class="module-closed-title">' + escapeHtml(label) + ' 已关闭</h1>' +
        '<p class="module-closed-text">站长暂时关闭了这个栏目，稍后再来看看吧。</p>' +
        '<button class="btn btn-primary" type="button" onclick="router.go(\'home\')">回到首页</button>' +
      '</section>';
    this.syncDock(tab);
    window.scrollTo(0, 0);
  },

  handlePopState: function () {
    this.applyRoute();
  },

  // 站点配置没到齐时最多等 1.2 秒：有缓存则立即返回，避免首页被网络阻塞
  waitSiteReady: function () {
    if (SITE_CONFIG.siteReady || SITE_CONFIG.hasConfig) return Promise.resolve();
    var ready = SITE_CONFIG.siteReadyPromise || Promise.resolve();
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 1200); });
    return Promise.race([ready, timeout]);
  },

  // 页面切换：直接替换内容。此前的 View Transitions / 入场动画会让一次点击出现
  // 「旧内容 → 骨架 → 新内容」两三次画面变化，看起来就是闪一下；现在一律瞬时替换。
  pageSwap: function (mutate) {
    mutate();
  },

  // 数据到达后替换内容：直接换，不做骨架叠层与淡入淡出
  fillContent: function (container, mutate) {
    mutate();
    window.scrollTo(0, 0);
  },

  animateContent: function () { /* 已停用：保留调用点，避免报错 */ },

  skeletonHtml: function (tab) {
    var label = { posts: '文章', moments: '瞬间', tools: '工具', status: '状态', quirky: '奇奇怪怪' }[tab] || '内容';
    var cards = '';
    for (var i = 0; i < 3; i++) cards += '<div class="sk-card"><div class="sk-line sk-line--title"></div><div class="sk-line sk-line--body"></div><div class="sk-line sk-line--short"></div></div>';
    return '<div class="page-skeleton" aria-busy="true" aria-label="正在加载' + label + '">' +
      '<div class="sk-line sk-line--head"></div>' +
      cards +
    '</div>';
  },

  signatureOf: function (list) {
    return (list || []).map(function (it) { return String(it.id) + '@' + String(it.date || it.mtime || ''); }).join('|');
  },

  go: async function (tab, skipUrl) {
    if (tab !== 'home') {
      await this.waitSiteReady();
      if (isModuleDisabled(tab)) {
        this.renderModuleClosed(tab, skipUrl);
        return;
      }
    }
    if (tab !== 'probe') {
      if (this.probeRefreshTimer) clearTimeout(this.probeRefreshTimer);
      this.probeRefreshTimer = null;
      this.probeRequestId += 1;
    }
    this.current = tab;
    if (!skipUrl) {
      if (tab === 'links-apply') this.syncUrl('/links/apply');
      else this.syncUrl(tab === 'home' ? '/' : '/' + moduleRoute(tab));
    }
    var navKey = tab === 'links-apply' ? 'links' : tab;
    var navEls = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < navEls.length; i++) {
      if (navEls[i].getAttribute('data-nav') === navKey) {
        navEls[i].setAttribute('aria-current', 'page');
      } else {
        navEls[i].removeAttribute('aria-current');
      }
    }

    var container = document.getElementById('page-content');
    container.classList.remove('is-reading');

    if (tab === 'home') {
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        container.innerHTML =
          '<section class="home-minimal">' +
            '<h1 class="home-title">' + escapeHtml(SITE_CONFIG.homeTitle) + '</h1>' +
            '<p class="home-bio">' + escapeHtml(SITE_CONFIG.homeBio) + '</p>' +
            renderHomeSocials() +
          '</section>';
      });
      syncClient.pingBackend();
      return;
    }

    if (tab === 'posts') {
      var self = this;
      var cached = sortNewestFirst(syncClient.getCache('posts').data);
      this.pageSwap(function () {
        window.scrollTo(0, 0);
      if (cached.length) {
        window.scrollTo(0, 0);
        self.cachedPosts = cached;
        self.renderPostsView(container, cached);
      } else {
        }
      });
      var fresh = sortNewestFirst(await syncClient.fetchModule('posts'));
      this.cachedPosts = fresh;
      var sig = this.signatureOf(fresh);
      if (this.current === 'posts' && (!cached.length || sig !== this.signatures.posts)) {
        this.signatures.posts = sig;
        this.fillContent(container, function () { self.renderPostsView(container, fresh); });
      }
      return;
    }

    if (tab === 'moments') {
      var cachedM = sortNewestFirst(syncClient.getCache('moments').data);
      var selfM = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        if (cachedM.length) selfM.renderMomentsView(container, cachedM);
      });
      var freshM = sortNewestFirst(await syncClient.fetchModule('moments'));
      var sigM = this.signatureOf(freshM);
      if (this.current === 'moments' && (!cachedM.length || sigM !== this.signatures.moments)) {
        this.signatures.moments = sigM;
        this.fillContent(container, function () { selfM.renderMomentsView(container, freshM); });
      }
      return;
    }

    if (tab === 'links-apply') {
      var selfLA = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        selfLA.renderLinksApplyView(container);
        selfLA.animateContent(container);
      });
      return;
    }

    if (tab === 'links') {
      var selfL = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
      });
      try {
        var resL = await fetch(SITE_CONFIG.apiBaseUrl + '/api/links?_t=' + Date.now(), { cache: 'no-store' });
        var jsonL = await resL.json();
        if (this.current !== 'links') return;
        var listL = (jsonL && jsonL.links) || [];
        this.fillContent(container, function () {
          selfL.renderLinksView(container, listL);
        });
      } catch (e) {
        if (this.current !== 'links') return;
        this.fillContent(container, function () {
          selfL.renderLinksView(container, []);
        });
      }
      return;
    }

    if (tab === 'tools') {
      var cachedT = syncClient.getCache('tools').data;
      var selfT = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        if (cachedT.length) selfT.renderToolsView(container, cachedT);
      });
      var freshT = await syncClient.fetchModule('tools');
      var sigT = this.signatureOf(freshT);
      if (this.current === 'tools' && sigT !== this.signatures.tools) {
        this.signatures.tools = sigT;
        this.fillContent(container, function () { selfT.renderToolsView(container, freshT); });
      }
      return;
    }

    if (tab === 'probe') {
      var selfP = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        selfP.renderProbeView(container);
      });
      return;
    }

    if (tab === 'status') {
      var cachedS = syncClient.getCache('status').data;
      var selfS = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        selfS.renderStatusView(container, cachedS);
      });
      var freshS = await syncClient.fetchModule('status');
      var sigS = this.signatureOf(freshS);
      if (this.current === 'status' && sigS !== this.signatures.status) {
        this.signatures.status = sigS;
        this.fillContent(container, function () { selfS.renderStatusView(container, freshS); });
      }
      return;
    }

    if (tab === 'quirky') {
      var cachedQ = syncClient.getCache('quirky').data;
      var selfQ = this;
      this.pageSwap(function () {
        window.scrollTo(0, 0);
        selfQ.renderQuirkyView(container, cachedQ);
      });
      var freshQ = await syncClient.fetchModule('quirky');
      var sigQ = this.signatureOf(freshQ);
      if (this.current === 'quirky' && sigQ !== this.signatures.quirky) {
        this.signatures.quirky = sigQ;
        this.fillContent(container, function () { selfQ.renderQuirkyView(container, freshQ); });
      }
      return;
    }
  },

  renderPostsView: function (container, posts) {
    var sortedPosts = sortNewestFirst(posts);
    var totalChars = 0;
    for (var i = 0; i < sortedPosts.length; i++) {
      totalChars += String(sortedPosts[i].excerpt || sortedPosts[i].content || '').length;
    }
    var days = Math.max(1, Math.floor((Date.now() - new Date(SITE_CONFIG.siteStartDate).getTime()) / 86400000));
    this.cachedPosts = sortedPosts;

    // 标签云：统计每篇文章的 tags（旧数据只有单个 tag 字段），按首次出现顺序展示
    var tagMap = {};
    var tagKeys = [];
    for (var t = 0; t < sortedPosts.length; t++) {
      var rowTags = sortedPosts[t].tags || (sortedPosts[t].tag ? [sortedPosts[t].tag] : []);
      for (var j = 0; j < rowTags.length; j++) {
        var tagText = String(rowTags[j] || '').trim();
        if (!tagText) continue;
        var tagKey = tagText.toLowerCase();
        if (!tagMap[tagKey]) { tagMap[tagKey] = { label: tagText, count: 0 }; tagKeys.push(tagKey); }
        tagMap[tagKey].count += 1;
      }
    }
    var tagCloud = '';
    if (tagKeys.length) {
      tagCloud +=
        '<div class="blog-tags">' +
          '<h2 class="blog-stats-title">标签</h2>' +
          '<div class="blog-tag-list">' +
            '<button type="button" class="blog-tag-chip" data-tag="" data-active="' + (this.activeTag ? 'false' : 'true') + '" onclick="router.selectTagFromButton(this)">全部</button>';
      for (var k = 0; k < tagKeys.length; k++) {
        var tagInfo = tagMap[tagKeys[k]];
        tagCloud +=
            '<button type="button" class="blog-tag-chip" data-tag="' + escapeHtml(tagKeys[k]) + '" data-active="' + (String(this.activeTag).toLowerCase() === tagKeys[k] ? 'true' : 'false') + '" onclick="router.selectTagFromButton(this)">' +
              escapeHtml(tagInfo.label) + '<span class="blog-tag-count">' + tagInfo.count + '</span>' +
            '</button>';
      }
      tagCloud += '</div></div>';
    }

    container.innerHTML =
      '<div class="page-wrap-with-aside">' +
        '<div class="blog-list-main">' +
          '<div class="blog-bar">' +
            '<span class="subnav-btn">近期发布</span>' +
            '<div class="blog-search">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/></svg>' +
              '<input type="text" id="blog-search-input" placeholder="搜索文章..." value="' + escapeHtml(this.searchQuery) + '" autocomplete="off" spellcheck="false" aria-label="搜索文章" />' +
            '</div>' +
          '</div>' +
          '<div id="post-list-host"></div>' +
        '</div>' +
        '<aside class="blog-aside">' +
          tagCloud +
          '<div class="blog-stats">' +
            '<h2 class="blog-stats-title">统计</h2>' +
            '<ul class="blog-stats-list">' +
              '<li class="blog-stats-item"><span>文章</span><span class="blog-stats-value">' + sortedPosts.length + '</span></li>' +
              '<li class="blog-stats-item"><span>字数</span><span class="blog-stats-value">' + (totalChars / 1000).toFixed(1) + 'K</span></li>' +
              '<li class="blog-stats-item"><span>运行时长</span><span class="blog-stats-value">' + days + ' 天</span></li>' +
            '</ul>' +
          '</div>' +
        '</aside>' +
      '</div>';

    this.bindPostSearch();
    this.updatePostList();
  },

  // 搜索框统一用 addEventListener 绑定：IME 组合期间不触发，组合结束后补一次，
  // 并支持回车 / Esc，避免内联 oninput 在中文输入时漏掉最后一次输入。
  bindPostSearch: function () {
    var input = document.getElementById('blog-search-input');
    if (!input) return;
    var self = this;
    this.imeComposing = false;
    input.addEventListener('compositionstart', function () {
      self.imeComposing = true;
    });
    input.addEventListener('compositionend', function () {
      self.imeComposing = false;
      setTimeout(function () {
        if (!self.imeComposing) self.onPostSearchInput(input.value, null);
      }, 0);
    });
    input.addEventListener('input', function (evt) {
      if (self.imeComposing || evt.isComposing) return;
      self.onPostSearchInput(input.value, null);
    });
    input.addEventListener('keydown', function (evt) {
      if (evt.isComposing || self.imeComposing) return;
      if (evt.key === 'Enter') {
        evt.preventDefault();
        self.onPostSearchInput(input.value, null);
      } else if (evt.key === 'Escape') {
        input.value = '';
        self.onPostSearchInput('', null);
      }
    });
  },

  filterPosts: function (posts, q) {
    var needle = String(q || '').trim().toLowerCase();
    var activeTag = String(this.activeTag || '').trim().toLowerCase();
    if (!needle && !activeTag) return posts;
    var out = [];
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      var rowTags = p.tags || (p.tag ? [p.tag] : []);
      var tagText = '';
      for (var t = 0; t < rowTags.length; t++) tagText += ' ' + String(rowTags[t] || '');
      if (activeTag && tagText.toLowerCase().indexOf(activeTag) === -1) continue;
      if (needle) {
        var hay = String(p.title || '') + ' ' + String(p.excerpt || p.content || '') + tagText;
        if (hay.toLowerCase().indexOf(needle) === -1) continue;
      }
      out.push(p);
    }
    return out;
  },

  // 标签框点击：再点一次取消筛选，「全部」清空
  selectTagFromButton: function (btn) {
    var next = btn && btn.getAttribute ? String(btn.getAttribute('data-tag') || '') : '';
    this.activeTag = (String(this.activeTag || '').toLowerCase() === next) ? '' : next;
    var chips = document.querySelectorAll('.blog-tag-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('data-active', chips[i].getAttribute('data-tag') === this.activeTag ? 'true' : 'false');
    }
    this.updatePostList();
  },

  buildPostRows: function (list) {
    if (!list.length) return '<div class="empty-box">没有匹配的文章</div>';
    var html = '<ul class="post-list">';
    for (var k = 0; k < list.length; k++) {
      var item = list[k];
      var isLocked = !!item.locked;
      var summary = isLocked ? '该文章已加密，输入口令后查看' : (item.excerpt || extractFirstLine(item.content));
      html +=
        '<li class="post-row">' +
          '<a class="post-row-link" href="/post/' + encodeURIComponent(String(item.id)) + '" onclick="router.openPost(\'' + escapeHtml(item.id) + '\');return false;">' +
            '<div class="post-row-top">' +
              '<h2 class="post-row-title">' + (isLocked ? '<span class="post-row-lock" aria-label="加密文章">🔒</span>' : '') + escapeHtml(item.title) + '</h2>' +
              '<time class="post-row-date">' + escapeHtml(item.date || '') + '</time>' +
            '</div>' +
            '<p class="post-row-firstline' + (isLocked ? ' post-row-firstline-locked' : '') + '">' + escapeHtml(summary) + '</p>' +
          '</a>' +
        '</li>';
    }
    html += '</ul>';
    return html;
  },

  updatePostList: function () {
    var host = document.getElementById('post-list-host');
    if (!host) return;
    host.innerHTML = this.buildPostRows(this.filterPosts(this.cachedPosts || [], this.searchQuery));
  },

  // 输入法组合期间不触发过滤，避免把拼音/候选字当成搜索词，也避免重建输入框
  onPostSearchInput: function (val, evt) {
    if (evt && evt.isComposing) return;
    this.searchQuery = String(val || '');
    this.updatePostList();
  },

  onSearch: function (val) {
    this.searchQuery = String(val || '');
    this.updatePostList();
  },

  openPost: async function (id) {
    this.syncUrl('/post/' + encodeURIComponent(String(id)));
    await this.renderPost(id);
  },

  // 渲染单篇文章：支持列表点击与直接通过 #/post/<id> 深链进入（如搜索引擎、分享链接）
  renderPost: async function (id) {
    if (!this.cachedPosts) this.cachedPosts = [];
    var post = null;
    for (var i = 0; i < this.cachedPosts.length; i++) {
      if (String(this.cachedPosts[i].id) === String(id)) {
        post = this.cachedPosts[i];
        break;
      }
    }

    // 不再因为本地缓存里有正文就跳过请求：隐藏文章必须每次回源确认。
    var fullPost;
    try {
      fullPost = await syncClient.fetchPost(id);
    } catch (e) {
      var status = Number(e && e.status) || 0;
      if (status === 404 || (!status && e && e.message === 'empty post')) {
        this.cachedPosts = this.cachedPosts.filter(function (p) { return String(p.id) !== String(id); });
        try { localStorage.removeItem('cache_v1_posts'); } catch (err) {}
        this.renderStatusPage(404, '这篇文章不存在，或者已经被作者隐藏。');
        return;
      }
      if (status === 401 || status === 403) {
        this.renderStatusPage(status);
        return;
      }
      this.renderStatusPage(500, '文章加载失败，请稍后再试。');
      return;
    }
    if (!fullPost || !fullPost.id) {
      this.renderStatusPage(404, '这篇文章不存在，或者已经被作者隐藏。');
      return;
    }

    // 加密文章的正文永远不会随公开接口返回；只保留锁定态，避免复用上次解锁的明文。
    if (fullPost.locked) {
      fullPost = Object.assign({}, fullPost, { content: '', unlocked: false });
    }
    post = Object.assign({}, post || {}, fullPost);
    var summary = Object.assign({}, post, { content: '', unlocked: false });
    var found = false;
    for (var c = 0; c < this.cachedPosts.length; c++) {
      if (String(this.cachedPosts[c].id) === String(post.id)) {
        this.cachedPosts[c] = Object.assign({}, this.cachedPosts[c], summary);
        found = true;
        break;
      }
    }
    if (!found) this.cachedPosts.unshift(summary);

    var isLocked = !!post.locked && !post.unlocked;
    var lockedHtml =
      '<div class="article-lock-card" id="article-lock-card">' +
        '<div class="article-lock-icon" aria-hidden="true">🔒</div>' +
        '<h2 class="article-lock-title">这篇文章已加密</h2>' +
        '<p class="article-lock-desc">' + escapeHtml(post.enchint || '请输入访问口令后查看全文') + '</p>' +
        '<form class="article-lock-form" id="article-lock-form" novalidate>' +
          '<input type="password" class="article-lock-input" id="article-lock-input" placeholder="访问口令" autocomplete="current-password" aria-label="访问口令" />' +
          '<button type="submit" class="article-lock-btn" id="article-lock-btn">解锁阅读</button>' +
        '</form>' +
        '<p class="article-lock-error" id="article-lock-error" hidden></p>' +
        '<p class="article-lock-tip">口令由作者设置，本站不会明文保存</p>' +
      '</div>' +
      '<div class="reader-content" id="reader-content-body" hidden></div>';
    this.current = 'post';
    this.syncDock('post');
    // 先瞬间归零再换内容：用平滑滚动会让新文章从底部“滑上来”，观感上就是闪一下
    window.scrollTo(0, 0);
    var container = document.getElementById('page-content');
    container.classList.add('is-reading');
    container.innerHTML =
      '<article class="article-reader">' +
        '<button class="back-btn" onclick="router.go(\'posts\')">← 返回文章列表</button>' +
        '<h1 class="reader-title">' + escapeHtml(post.title) + '</h1>' +
        '<div class="reader-meta">' + escapeHtml(post.date || '') + '</div>' +
        (isLocked ? lockedHtml : '<div class="reader-content" id="reader-content-body">' + renderMarkdown(post.content) + '</div>') +
        '<footer class="article-license">' +
          '本文采用 <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT License</a> 授权发布 · 转载请注明出处' +
        '</footer>' +
        '<section class="comments-section">' +
          '<div class="comments-head">' +
            '<h2 class="comments-title">评论区</h2>' +
            '<span class="comments-note">支持回复任意评论 · 经后台审核通过后显示</span>' +
          '</div>' +
          '<div class="comment-form" id="comment-form-box">' +
            '<div class="replying-banner" id="replying-banner" data-active="false">' +
              '<span>正在回复 <strong id="replying-target-name"></strong> 的评论</span>' +
              '<button type="button" class="replying-cancel-btn" onclick="commentBox.cancelReply()">✕ 取消回复</button>' +
            '</div>' +
            '<div class="comment-form-row">' +
              '<input class="comment-input" id="comment-author" type="text" maxlength="32" placeholder="您的昵称 *" />' +
              '<input class="comment-input" id="comment-contact" type="text" maxlength="80" placeholder="邮箱或个人网站 (选填，不公开)" />' +
            '</div>' +
            '<input type="text" id="comment-hp" style="display:none;" tabindex="-1" autocomplete="off" />' +
            '<textarea class="comment-textarea" id="comment-content" maxlength="1000" placeholder="写下您的想法... *"></textarea>' +
            '<div class="turnstile-slot" id="comment-turnstile" hidden></div>' +
            '<div class="comment-submit-row">' +
              '<div class="captcha-box">' +
                '<span>验证：</span>' +
                '<span class="captcha-question" id="captcha-question" title="点击更换题目" onclick="commentBox.refreshCaptcha()">加载中...</span>' +
                '<input class="captcha-input" id="captcha-answer" type="text" maxlength="6" placeholder="答案" />' +
              '</div>' +
              '<button type="button" class="comment-submit-btn" id="comment-submit-btn" onclick="commentBox.submit()">发送评论</button>' +
            '</div>' +
            '<div class="comment-feedback" id="comment-feedback"></div>' +
          '</div>' +
          '<ul class="comment-list" id="comment-list"></ul>' +
        '</section>' +
      '</article>';

    commentBox.loadSection(post.id);
    if (isLocked) this.bindArticleUnlock(post);
    else this.bindFragmentLocks(container);
  },

  // 整篇加密：输口令 → POST /api/public/post/<id>/unlock → 渲染正文
  bindArticleUnlock: function (post) {
    var form = document.getElementById('article-lock-form');
    if (!form) return;
    var self = this;
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var input = document.getElementById('article-lock-input');
      var errEl = document.getElementById('article-lock-error');
      var btn = document.getElementById('article-lock-btn');
      var body = document.getElementById('reader-content-body');
      var card = document.getElementById('article-lock-card');
      var password = input ? input.value : '';
      function fail(msg) {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.hidden = false;
        if (input) input.focus();
      }
      if (!password) { fail('请输入访问口令'); return; }
      if (errEl) errEl.hidden = true;
      if (btn) { btn.disabled = true; btn.textContent = '解密中...'; }
      try {
        var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
        var res = await fetch(base + '/api/public/post/' + encodeURIComponent(String(post.id)) + '/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || '口令错误');
        if (body) {
          body.hidden = false;
          body.innerHTML = renderMarkdown(data.content || '');
          self.bindFragmentLocks(body);
        }
        if (card) card.hidden = true;
        for (var i = 0; i < self.cachedPosts.length; i++) {
          if (String(self.cachedPosts[i].id) === String(post.id)) {
            self.cachedPosts[i].content = data.content || '';
            self.cachedPosts[i].unlocked = true;
            break;
          }
        }
      } catch (err) {
        fail((err && err.message) || '口令错误');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '解锁阅读'; }
      }
    });
    var focusInput = document.getElementById('article-lock-input');
    if (focusInput) focusInput.focus();
  },

  // 正文里的加密片段：把 .md-lock 卡片接上解锁逻辑，成功后原地替换成真实内容
  bindFragmentLocks: function (root) {
    var scope = root || document.getElementById('page-content');
    if (!scope || !scope.querySelectorAll) return;
    var cards = scope.querySelectorAll('.md-lock');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        if (card.getAttribute('data-bound') === '1') return;
        card.setAttribute('data-bound', '1');
        var input = card.querySelector('.md-lock-input');
        var btn = card.querySelector('.md-lock-btn');
        var errEl = card.querySelector('.md-lock-error');
        if (!input || !btn) return;
        async function tryUnlock() {
          var password = input.value;
          if (!password) {
            if (errEl) { errEl.hidden = false; errEl.textContent = '请输入口令'; }
            input.focus();
            return;
          }
          if (errEl) errEl.hidden = true;
          btn.disabled = true;
          var oldLabel = btn.textContent;
          btn.textContent = '解密中...';
          try {
            var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
            var res = await fetch(base + '/api/public/unlock-fragment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payload: card.getAttribute('data-lock') || '', password: password })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || '口令错误');
            var opened = document.createElement('div');
            opened.className = 'md-lock-opened';
            opened.innerHTML = renderMarkdown(data.content || '');
            if (card.parentNode) card.parentNode.replaceChild(opened, card);
            router.bindFragmentLocks(opened);
          } catch (err) {
            if (errEl) {
              errEl.hidden = false;
              errEl.textContent = (err && err.message) || '口令错误或该片段已损坏';
            }
          } finally {
            btn.disabled = false;
            btn.textContent = oldLabel;
          }
        }
        btn.addEventListener('click', tryUnlock);
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); tryUnlock(); }
        });
      })(cards[i]);
    }
  },

renderLinksView: function (container, links) {
    var list = Array.isArray(links) ? links.slice() : [];
    var cards = list.map(function (item) {
      var icon = item.icon
        ? '<img class="friend-icon" src="' + escapeHtml(item.icon) + '" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'friend-initial\',textContent:this.dataset.initial||\'?\'}))" data-initial="' + escapeHtml(item.initial || (item.name || '?').charAt(0)) + '">'
        : '<span class="friend-initial">' + escapeHtml(item.initial || (item.name || '?').charAt(0)) + '</span>';
      var host = '';
      try { host = new URL(item.url).hostname.replace(/^www\./, ''); } catch (e) { host = item.url || ''; }
      return (
        '<li class="friend-card">' +
          '<a class="friend-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' +
            icon +
            '<span class="friend-body">' +
              '<span class="friend-name">' + escapeHtml(item.name || host) + '</span>' +
              '<span class="friend-host">' + escapeHtml(host) + '</span>' +
              (item.note ? '<span class="friend-note">' + escapeHtml(item.note) + '</span>' : '') +
            '</span>' +
          '</a>' +
        '</li>'
      );
    }).join('');

    container.innerHTML =
      '<section class="links-view">' +
        '<header class="links-head">' +
          '<div class="links-head-text">' +
            '<h1 class="links-title">期待与你相遇</h1>' +
            '<p class="links-sub">这里收藏了一些我在写作路上遇到的朋友。如果你也有一个认真维护的小站，欢迎交换友链，让彼此被更多人看见。</p>' +
          '</div>' +
          '<button class="btn links-apply-btn" type="button" onclick="router.go(\'links-apply\')">加入友链</button>' +
        '</header>' +
        (cards
          ? '<ul class="friend-grid">' + cards + '</ul>'
          : '<div class="links-empty">' +
              '<p>还没有友链，等你来做第一个。</p>' +
            '</div>') +
      '</section>';
  },

renderLinksApplyView: function (container) {
    container.innerHTML =
      '<section class="links-view">' +
        '<button class="back-btn" type="button" onclick="router.go(\'links\')">← 返回友链</button>' +
        '<header class="links-head links-head--form">' +
          '<div class="links-head-text">' +
            '<h1 class="links-title">加入友链</h1>' +
            '<p class="links-sub">欢迎你的加入！填写一些基本信息，管理员会尽快审核，通过后就会出现在友链页。</p>' +
          '</div>' +
        '</header>' +
        '<form class="links-form" id="links-apply-form" novalidate>' +
          '<label class="links-field">' +
            '<span class="links-label">网站 URL</span>' +
            '<input class="links-input" id="friend-url" type="url" name="url" placeholder="https://example.com" maxlength="200" required />' +
            '<span class="links-hint">完整地址，例如 https://example.com</span>' +
          '</label>' +
          '<label class="links-field">' +
            '<span class="links-label">网站名</span>' +
            '<input class="links-input" id="friend-name" type="text" name="name" placeholder="我的小站" maxlength="30" required />' +
          '</label>' +
          '<label class="links-field">' +
            '<span class="links-label">图标 URL<span class="links-optional">选填</span></span>' +
            '<input class="links-input" id="friend-icon" type="url" name="icon" placeholder="https://example.com/icon.png" maxlength="200" />' +
            '<span class="links-hint">方形图片更好看；不填就用网站名首字代替</span>' +
          '</label>' +
          '<label class="links-field">' +
            '<span class="links-label">邮箱<span class="links-optional">选填</span></span>' +
            '<input class="links-input" id="friend-email" type="email" name="email" placeholder="you@example.com" maxlength="120" />' +
            '<span class="links-hint">填写后可通过邮件收到审核结果</span>' +
          '</label>' +
          '<label class="links-field links-field--note">' +
            '<span class="links-label">一句话介绍<span class="links-optional">选填</span></span>' +
            '<input class="links-input" id="friend-note" type="text" name="note" placeholder="写点关于这个站的说明" maxlength="80" />' +
          '</label>' +
          '<div class="turnstile-slot" id="links-turnstile" hidden></div>' +
          '<input class="links-hp" id="friend-website" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
          '<div class="links-actions">' +
            '<button class="btn btn-primary" id="links-submit" type="submit">提交申请</button>' +
            '<span class="links-feedback" id="links-feedback" role="status"></span>' +
          '</div>' +
        '</form>' +
      '</section>';

    var form = document.getElementById('links-apply-form');
    if (!form) return;
    var feedback = document.getElementById('links-feedback');
    var submitBtn = document.getElementById('links-submit');

    function setFeedback(text, ok) {
      if (!feedback) return;
      feedback.textContent = text || '';
      feedback.setAttribute('data-ok', ok ? 'true' : 'false');
    }

    var linksTurnstileToken = '';
    var linksTurnstileWidget = null;
    if (SITE_CONFIG.turnstileSiteKey) {
      renderTurnstile(document.getElementById('links-turnstile'), 'link', function (token) {
        linksTurnstileToken = token;
      }).then(function (widget) {
        linksTurnstileWidget = widget;
        if (widget === null) setFeedback('人机验证加载失败，请刷新页面后重试', false);
      });
    }

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var url = (document.getElementById('friend-url') || {}).value || '';
      var name = (document.getElementById('friend-name') || {}).value || '';
      var icon = (document.getElementById('friend-icon') || {}).value || '';
      var note = (document.getElementById('friend-note') || {}).value || '';
      var email = (document.getElementById('friend-email') || {}).value || '';
      var hp = (document.getElementById('friend-website') || {}).value || '';

      if (!url.trim()) return setFeedback('请填写网站地址', false);
      if (!name.trim()) return setFeedback('请填写网站名', false);
      if (SITE_CONFIG.turnstileSiteKey && !linksTurnstileToken) {
        return setFeedback('请先完成人机验证', false);
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '提交中…';
      setFeedback('', true);
      try {
        var res = await fetch(SITE_CONFIG.apiBaseUrl + '/api/links/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), name: name.trim(), icon: icon.trim(), note: note.trim(), email: email.trim(), website: hp, turnstileToken: linksTurnstileToken })
        });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.ok) {
          setFeedback('已提交，等站长审核通过后就会出现在友链页。', true);
          form.reset();
        } else {
          setFeedback((data && data.error) || '提交失败，请稍后再试', false);
        }
        if (SITE_CONFIG.turnstileSiteKey) {
          resetTurnstile(linksTurnstileWidget);
          linksTurnstileToken = '';
        }
      } catch (e) {
        setFeedback('网络不太顺畅，请稍后再试', false);
        if (SITE_CONFIG.turnstileSiteKey) {
          resetTurnstile(linksTurnstileWidget);
          linksTurnstileToken = '';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交申请';
      }
    });
  },

  renderMomentsView: function (container, moments) {
    var sortedMoments = sortNewestFirst(moments);
    var listHtml = '';
    if (sortedMoments.length) {
      listHtml = '<div class="moments-feed">';
      for (var i = 0; i < sortedMoments.length; i++) {
        var m = sortedMoments[i];
        listHtml +=
          '<article class="moment-item">' +
            '<div class="moment-meta">' +
              '<span>' + escapeHtml(m.date || '') + '</span>' +
              (m.tag ? '<span>#' + escapeHtml(m.tag) + '</span>' : '') +
            '</div>' +
            '<div class="moment-body">' + renderMarkdown(m.content) + '</div>' +
          '</article>';
      }
      listHtml += '</div>';
    } else {
      listHtml = '<div class="empty-box">暂无瞬间动态</div>';
    }
    container.innerHTML = '<div class="module-header"><h1 class="module-title">瞬间</h1></div>' + listHtml;
  },

  renderToolsView: function (container, tools) {
    var gridHtml = '';
    if (tools.length) {
      gridHtml = '<div class="tools-grid">';
      for (var i = 0; i < tools.length; i++) {
        var t = tools[i];
        var iconHtml = (t.icon && t.icon.indexOf('http') === 0)
          ? '<img src="' + escapeHtml(t.icon) + '" alt="" loading="lazy" />'
          : escapeHtml((t.title || 'T').slice(0, 1).toUpperCase());
        gridHtml +=
          '<a class="tool-card" href="' + escapeHtml(t.url) + '" target="_blank" rel="noopener noreferrer">' +
            '<div class="tool-icon">' + iconHtml + '</div>' +
            '<div class="tool-info">' +
              '<div class="tool-title">' + escapeHtml(t.title) + '</div>' +
              '<div class="tool-desc">' + escapeHtml(t.desc || '') + '</div>' +
            '</div>' +
          '</a>';
      }
      gridHtml += '</div>';
    } else {
      gridHtml = '<div class="empty-box">暂无导航工具</div>';
    }
    container.innerHTML = '<div class="module-header"><h1 class="module-title">工具</h1></div>' + gridHtml;
  },

  renderProbeView: function (container) {
    container.innerHTML =
      '<div class="module-header">' +
        '<h1 class="module-title">探针</h1>' +
        '<div class="probe-actions">' +
          '<a class="probe-panel-link" id="probe-panel-link" href="#" target="_blank" rel="noopener noreferrer" hidden>打开监控后台 ↗</a>' +
          '<button type="button" onclick="router.refreshProbeView()" aria-label="刷新服务器状态" title="刷新服务器状态">刷新</button>' +
        '</div>' +
      '</div>' +
      '<div class="probe-content" id="probe-content"><div class="empty-box">正在读取服务器状态…</div></div>';
    this.refreshProbeView();
  },

  // 监控后台入口：后台配置了 panelUrl 才显示
  setProbePanelLink: function (url) {
    var link = document.getElementById('probe-panel-link');
    if (!link) return;
    var target = String(url || '').trim();
    if (!target) {
      link.hidden = true;
      link.removeAttribute('href');
      return;
    }
    link.href = target;
    link.hidden = false;
  },

  refreshProbeView: async function () {
    if (this.probeRefreshTimer) clearTimeout(this.probeRefreshTimer);
    this.probeRefreshTimer = null;
    var container = document.getElementById('probe-content');
    if (!container || this.current !== 'probe') return;
    var requestId = ++this.probeRequestId;
    var button = document.querySelector('.probe-actions button');
    if (button) button.disabled = true;
    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var response = await fetch(base + '/api/probe-servers?_t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload && payload.error ? payload.error : ('HTTP ' + response.status));
      }
      if (!Array.isArray(payload.servers)) throw new Error('Invalid probe response');
      if (this.current === 'probe' && requestId === this.probeRequestId) {
        this.setProbePanelLink(payload.panelUrl);
        if (payload.enabled === false) {
          container.innerHTML = '<div class="empty-box">探针未启用。可在后台「管理 → 探针」中开启并选择数据来源。</div>';
          return;
        }
        this.renderProbeServers(container, payload.servers, payload);
      }
    } catch (err) {
      if (this.current === 'probe' && requestId === this.probeRequestId) {
        var reason = err && err.message ? String(err.message) : '';
        container.innerHTML = '<div class="empty-box">' +
          (reason && reason.indexOf('未配置探针地址') !== -1 ? '还没有配置探针地址，请在后台「管理 → 探针」中填写。' : '暂时无法读取服务器状态，请稍后重试。') +
          '</div>';
      }
    } finally {
      if (requestId === this.probeRequestId) {
        if (button) button.disabled = false;
        if (this.current === 'probe') {
          this.probeRefreshTimer = setTimeout(function () { router.refreshProbeView(); }, 30000);
        }
      }
    }
  },

  renderProbeServers: function (container, servers, meta) {
    var info = meta || {};
    var panelLabel = info.label || '监控';

    if (!servers.length) {
      container.innerHTML = '<div class="empty-box">暂无公开服务器</div>' +
        (info.error ? '<div class="empty-box">' + escapeHtml(String(info.error)) + '</div>' : '');
      return;
    }

    var onlineCount = 0;
    var cards = '';
    for (var i = 0; i < servers.length; i++) {
      var server = servers[i] || {};
      var online = server.online === true;
      if (online) onlineCount += 1;

      var cpu = Number(server.cpu);
      var memTotal = Number(server.memTotal);
      var memUsed = Number(server.memUsed);
      var diskTotal = Number(server.diskTotal);
      var diskUsed = Number(server.diskUsed);

      var memoryLabel = Number.isFinite(memTotal) && memTotal > 0
        ? (memUsed / 1024).toFixed(1) + ' / ' + (memTotal / 1024).toFixed(1) + ' GB'
        : '--';
      var diskPercent = Number.isFinite(diskTotal) && diskTotal > 0
        ? Math.round((diskUsed / diskTotal) * 100) + '%'
        : '--';
      var networkLabel = Number.isFinite(Number(server.netIn)) && Number.isFinite(Number(server.netOut))
        ? '↓ ' + formatProbeSpeed(server.netIn) + ' · ↑ ' + formatProbeSpeed(server.netOut)
        : '--';

      var pingHtml = '';
      var pings = Array.isArray(server.pings) ? server.pings : [];
      for (var n = 0; n < pings.length; n++) {
        var pingValue = Number(pings[n] && pings[n].ms);
        if (Number.isFinite(pingValue) && pingValue >= 0) {
          pingHtml += '<span><small>' + escapeHtml(String(pings[n].label || '')) + '</small>' + pingValue.toFixed(0) + ' ms</span>';
        }
      }

      var lastUpdated = Number(server.lastUpdated);
      var checked = lastUpdated > 0
        ? new Date(lastUpdated).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
        : '等待上报';

      cards +=
        '<article class="probe-server-card">' +
          '<div class="probe-server-heading">' +
            '<div><h2>' + escapeHtml(server.name || '未命名服务器') + '</h2><span>' + escapeHtml(server.region || server.group || '未标记区域') + '</span></div>' +
            '<span class="probe-state" data-online="' + (online ? 'true' : 'false') + '"><i></i>' + (online ? '在线' : '离线') + '</span>' +
          '</div>' +
          '<div class="probe-metrics">' +
            '<div><small>CPU</small><strong>' + (Number.isFinite(cpu) ? cpu.toFixed(1) + '%' : '--') + '</strong></div>' +
            '<div><small>内存</small><strong>' + escapeHtml(memoryLabel) + '</strong></div>' +
            '<div><small>磁盘</small><strong>' + escapeHtml(diskPercent) + '</strong></div>' +
            '<div><small>网络吞吐</small><strong>' + escapeHtml(networkLabel) + '</strong></div>' +
          '</div>' +
          (pingHtml ? '<div class="probe-ping-list">' + pingHtml + '</div>' : '') +
          '<div class="probe-server-updated">最近上报 ' + escapeHtml(checked) + '</div>' +
        '</article>';
    }

    var overviewState = onlineCount === servers.length ? 'true' : (onlineCount ? 'warn' : 'false');
    container.innerHTML =
      '<div class="probe-overview"><strong><i data-state="' + overviewState + '"></i>' + onlineCount + ' / ' + servers.length + ' 台服务器在线</strong>' +
      '<span>每 30 秒自动更新 · 数据由 ' + escapeHtml(panelLabel) + ' 提供</span></div>' +
      '<div class="probe-server-list">' + cards + '</div>';
  },

  renderStatusView: function (container, services) {
    var items = Array.isArray(services) ? services : [];
    var allUp = true;
    var contentHtml = '';

    if (items.length) {
      contentHtml = '<div class="status-service-list">';
      for (var i = 0; i < items.length; i++) {
        var s = items[i];
        if (s.ok === false) allUp = false;
        var hist = Array.isArray(s.history) ? s.history : [];
        var bars = '';
        for (var b = 0; b < 45; b++) {
          var idx = hist.length - 45 + b;
          if (idx < 0) {
            bars += '<span class="uptime-bar" style="background:var(--bg-subtle);opacity:1;"></span>';
          } else {
            var h = hist[idx];
            var color = h.state === 'down' ? '#EF4444' : (h.state === 'warn' ? '#F59E0B' : 'var(--status-ok)');
            var tip = 'HTTP ' + h.code + ' · ' + h.ms + 'ms';
            bars += '<span class="uptime-bar" title="' + escapeHtml(tip) + '" style="background:' + color + ';"></span>';
          }
        }
        var badgeColor = s.ok === false ? '#EF4444' : 'var(--status-ok)';
        var codeLabel = s.statusCode ? ('HTTP ' + s.statusCode) : '探测中';

        contentHtml +=
          '<div class="status-card">' +
            '<div class="status-card-head">' +
              '<span>' + escapeHtml(s.name) + ' <small style="font-family:var(--font-mono);font-weight:400;color:var(--text-muted);margin-left:6px;">' + escapeHtml(s.url || '') + '</small></span>' +
              '<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);">' +
                '<strong style="color:' + badgeColor + ';margin-right:8px;">' + escapeHtml(codeLabel) + '</strong>' +
                'SLA ' + escapeHtml(s.uptime || '100%') + ' · ' + escapeHtml(s.latency || '-- ms') +
              '</span>' +
            '</div>' +
            '<div class="status-uptime-bars">' + bars + '</div>' +
          '</div>';
      }
      contentHtml += '</div>';
    } else {
      contentHtml = '<div class="empty-box">暂无状态监控节点数据</div>';
    }

    var pulseColor = allUp ? 'var(--status-ok)' : '#EF4444';
    var bannerTitle = allUp ? '所有监控节点 HTTP 200 运行正常' : '部分监控节点响应异常';

    container.innerHTML =
      '<div class="module-header"><h1 class="module-title">状态</h1></div>' +
      '<div class="status-overview">' +
        '<div><span class="status-pulse" style="background:' + pulseColor + ';"></span><strong>' + bannerTitle + '</strong></div>' +
        '<span style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">REALTIME HTTP 200 PROBE (60S)</span>' +
      '</div>' +
      contentHtml;
  },

  renderQuirkyView: function (container, items) {
    var list = Array.isArray(items) ? items : [];
    var listHtml = '';
    if (list.length) {
      listHtml = '<div class="tools-grid">';
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        listHtml +=
          '<a class="tool-card" href="' + escapeHtml(item.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
            '<div class="tool-info">' +
              '<div class="tool-title">' + escapeHtml(item.title) + '</div>' +
              '<div class="tool-desc">' + escapeHtml(item.desc || '') + '</div>' +
            '</div>' +
          '</a>';
      }
      listHtml += '</div>';
    } else {
      listHtml = '<div class="empty-box">暂无实验室项目</div>';
    }
    container.innerHTML = '<div class="module-header"><h1 class="module-title">奇奇怪怪</h1></div>' + listHtml;
  }
};

/* ================= Markdown 增强：复制 / 灯箱 / 流程图 ================= */
(function () {
  var mask = null;
  var mermaidApi = null;
  var mermaidLoading = null;

  function codeText(codeEl) {
    if (!codeEl) return '';
    var rows = codeEl.querySelectorAll('.code-line');
    if (!rows.length) return codeEl.textContent || '';
    return Array.prototype.map.call(rows, function (row) {
      return (row.textContent || '').replace(/\u200b/g, '');
    }).join('\n');
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function flash(btn, text) {
    if (!btn) return;
    var origin = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', origin);
    btn.textContent = text;
    btn.classList.add('is-done');
    clearTimeout(btn.__flashTimer);
    btn.__flashTimer = setTimeout(function () {
      btn.textContent = origin;
      btn.classList.remove('is-done');
    }, 1400);
  }

  function ensureMask() {
    if (mask) return mask;
    mask = document.createElement('div');
    mask.className = 'md-lightbox';
    mask.innerHTML =
      '<div class="md-lightbox-inner">' +
        '<div class="md-lightbox-bar">' +
          '<span class="md-lightbox-lang"></span>' +
          '<div class="md-lightbox-actions">' +
            '<button type="button" class="md-lightbox-btn" data-action="copy">复制</button>' +
            '<button type="button" class="md-lightbox-btn" data-action="close" aria-label="关闭">关闭</button>' +
          '</div>' +
        '</div>' +
        '<div class="md-lightbox-body"></div>' +
      '</div>';
    mask.addEventListener('click', function (event) {
      if (event.target === mask) return closeLightbox();
      var action = event.target.closest('[data-action]');
      if (!action) return;
      if (action.getAttribute('data-action') === 'close') return closeLightbox();
      if (action.getAttribute('data-action') === 'copy') {
        copyText(codeText(mask.querySelector('.md-lightbox-body code'))).then(function (ok) {
          flash(action, ok ? '已复制' : '复制失败');
        });
      }
    });
    document.body.appendChild(mask);
    return mask;
  }

  function openLightbox(lang, innerHtml, extraClass) {
    var box = ensureMask();
    box.querySelector('.md-lightbox-lang').textContent = lang || '';
    box.querySelector('.md-lightbox-body').innerHTML = innerHtml;
    box.className = 'md-lightbox is-open' + (extraClass ? ' ' + extraClass : '');
    document.body.classList.add('md-lightbox-locked');
  }

  function closeLightbox() {
    if (!mask) return;
    mask.className = 'md-lightbox';
    mask.querySelector('.md-lightbox-body').innerHTML = '';
    document.body.classList.remove('md-lightbox-locked');
  }

  document.addEventListener('click', function (event) {
    var copyBtn = event.target.closest('.code-copy');
    if (copyBtn) {
      event.preventDefault();
      var block = copyBtn.closest('.code-block');
      copyText(codeText(block && block.querySelector('code'))).then(function (ok) { flash(copyBtn, ok ? '已复制' : '复制失败'); });
      return;
    }
    var expandBtn = event.target.closest('.code-expand');
    if (expandBtn) {
      event.preventDefault();
      var target = expandBtn.closest('.code-block');
      if (!target) return;
      var pre = target.querySelector('pre');
      openLightbox(target.getAttribute('data-lang') || 'text', pre ? pre.outerHTML : '', 'is-code');
      return;
    }
    var image = event.target.closest('img.md-image');
    if (image && image.getAttribute('src')) {
      event.preventDefault();
      openLightbox(image.getAttribute('alt') || '', '<img class="md-lightbox-image" src="' + image.getAttribute('src') + '" alt="' + (image.getAttribute('alt') || '') + '" />', 'is-image');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeLightbox();
  });

  function loadMermaid() {
    if (mermaidLoading) return mermaidLoading;
    mermaidLoading = import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
      .then(function (mod) {
        var api = mod.default || mod;
        api.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
          flowchart: { htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: true }
        });
        mermaidApi = api;
        return api;
      })
      .catch(function () { return null; });
    return mermaidLoading;
  }

  var mermaidSeq = 0;
  function renderMermaidBlocks() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid:not([data-rendered])'));
    if (!nodes.length) return;
    nodes.forEach(function (node) { node.setAttribute('data-rendered', '1'); });
    loadMermaid().then(function (api) {
      if (!api) {
        nodes.forEach(function (node) { node.classList.add('mermaid-error'); });
        return;
      }
      nodes.forEach(function (node) {
        var source = node.textContent || '';
        var id = 'mermaid-svg-' + (++mermaidSeq);
        api.render(id, source).then(function (result) {
          node.innerHTML = result.svg;
          node.classList.add('mermaid-done');
        }).catch(function () {
          node.classList.add('mermaid-error');
        });
      });
    });
  }

  var renderTimer = null;
  function scheduleMermaid() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderMermaidBlocks, 80);
  }

  if (window.MutationObserver) {
    var host = document.getElementById('page-content') || document.body;
    new MutationObserver(scheduleMermaid).observe(host, { childList: true, subtree: true });
  }
  window.addEventListener('load', scheduleMermaid);

  // 供外部（如后台预览）手动触发
  window.markdownEnhance = function () { scheduleMermaid(); };
})();



// 浏览器前进/后退：跟随地址变化重渲染
window.addEventListener('popstate', function () { router.handlePopState(); });

// 移动端底栏「液态玻璃」：只负责把选中胶囊摆到当前栏目下，并做滚动隐藏
(function () {
  var dock = document.getElementById('mobile-dock');
  var glider = document.getElementById('dock-glider');
  if (!dock || !glider) return;

  function buttons() {
    return Array.prototype.filter.call(dock.querySelectorAll('.mobile-dock-btn'), function (b) {
      return !b.hidden && b.offsetWidth > 0;
    });
  }

  function activeButton() {
    var list = buttons();
    if (!list.length) return null;
    var cur = dock.querySelector('.mobile-dock-btn[aria-current="page"]');
    if (!cur || cur.hidden || !cur.offsetWidth) cur = list[0];
    return cur;
  }

  function sync(animate) {
    var btn = activeButton();
    if (!btn) return;
    var dr = dock.getBoundingClientRect();
    var br = btn.getBoundingClientRect();
    var border = parseFloat(getComputedStyle(dock).borderLeftWidth) || 0;
    if (animate === false) glider.style.transition = 'none';
    else glider.style.transition = '';
    glider.style.width = br.width + 'px';
    glider.style.transform = 'translate3d(' + (br.left - dr.left - border) + 'px,0,0)';
    if (!glider.classList.contains('is-ready')) glider.classList.add('is-ready');
  }

  var mo = new MutationObserver(function () { sync(true); });
  mo.observe(dock, { attributes: true, subtree: true, attributeFilter: ['aria-current', 'hidden', 'style'] });
  window.addEventListener('resize', function () { sync(false); });
  window.addEventListener('orientationchange', function () { window.setTimeout(function () { sync(false); }, 260); });

  // 除首页外，向下滚隐藏、向上滚出现；回到首页总是显示
  var lastY = window.pageYOffset || 0;
  var dockHidden = false;
  var ticking = false;

  function setHidden(next) {
    if (next === dockHidden) return;
    dockHidden = next;
    dock.classList.toggle('is-hidden', next);
    // 隐藏时让底栏不再挡住页面，但不影响布局
    dock.setAttribute('aria-hidden', next ? 'true' : 'false');
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      var y = window.pageYOffset || 0;
      var onHome = (typeof router !== 'undefined' && router && router.current === 'home');
      if (onHome || y < 72) {
        setHidden(false);
      } else if (y > lastY + 8 && y > 160) {
        setHidden(true);
      } else if (y < lastY - 8) {
        setHidden(false);
      }
      lastY = y;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.__refreshDock = function () { lastY = window.pageYOffset || 0; setHidden(false); sync(true); };

  function boot() {
    sync(false);
    window.requestAnimationFrame(function () { sync(false); });
    window.setTimeout(function () { sync(true); }, 220);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  boot();
})();

// 首次进入：立刻按地址渲染（页面完整性优先）。
// 站点配置已在上面同步套用过缓存，网络慢/后端挂了也不会卡住首屏；
// 自定义路径若在配置到达后才可识别，applySitePayload 会补一次 reroute。
router.applyRoute();

// 进站先探一次后端，让侧边栏「节点」在任意页面都能显示 ONLINE（而不是停在 CHECKING）
syncClient.pingBackend();
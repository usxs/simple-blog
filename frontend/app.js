var SITE_CONFIG = {
  name: '简单博客',
  owner: '博主',
  avatarText: '简',
  homeTitle: 'Hi, I am here.',
  homeBio: '这里是我的个人博客，记录技术、折腾与生活。',
  apiBaseUrl: 'https://api.example.com',
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

var ICON_FALLBACK = {
  home: { name: '首页', icon: 'home' },
  posts: { name: '文章', icon: 'book' },
  moments: { name: '碎碎念', icon: 'message' },
  tools: { name: '工具', icon: 'wrench' },
  probe: { name: '探针', icon: 'activity' },
  status: { name: '状态', icon: 'heart' },
  quirky: { name: '奇奇怪怪', icon: 'star' }
};

// 前台栏目：后端「管理」页可开关 / 改名 / 换图标，GET /api/site 返回 modules
var MODULE_KEYS = ['home', 'posts', 'moments', 'tools', 'probe', 'status', 'quirky'];

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

// 栏目访问路径（可在后台「管理 → 前台栏目」自定义，如把 /moments 改成 /diary）
function moduleRoute(key) {
  var cfg = SITE_CONFIG.modules;
  var r = cfg && cfg[key] && cfg[key].route;
  r = String(r || (key === 'home' ? '' : key));
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
function applySiteModules(raw) {
  var cfg = normalizeModuleConfig(raw);
  SITE_CONFIG.modules = cfg;
  MODULE_KEYS.forEach(function (key) {
    if (key === 'home') return;
    var m = cfg[key];
    var items = document.querySelectorAll('[data-nav="' + key + '"]');
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      el.hidden = !m.enabled;
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
  var bg = isDark ? '%23F4F4F5' : '%23141416';
  var fg = isDark ? '%23141416' : '%23FFFFFF';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34">' +
    '<rect width="34" height="34" rx="7" fill="' + bg + '"/>' +
    '<text x="50%" y="53%" dominant-baseline="central" text-anchor="middle" fill="' + fg + '" font-family="monospace" font-weight="600" font-size="18">' +
    encodeURIComponent(charText) +
    '</text></svg>';
  var link = document.getElementById('dynamic-favicon');
  if (link) {
    link.href = 'data:image/svg+xml,' + svg;
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
// 路由需要等它完成，才能判断栏目是否被关闭
SITE_CONFIG.siteReady = false;
SITE_CONFIG.siteReadyPromise = null;

(function applyRemoteSiteInfo() {
  var base = String(SITE_CONFIG.apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) { SITE_CONFIG.siteReady = true; return; }
  SITE_CONFIG.siteReadyPromise = fetch(base + '/api/site', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.ok || !data.site) return;
      var site = data.site;
      var ssrTitled = Boolean(window.__SSR_META__ && window.__SSR_META__.title);

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
      if (site.modules) applySiteModules(site.modules);
      if (site.subtitle) {
        SITE_CONFIG.homeBio = String(site.subtitle);
        var bioEl = document.querySelector('.home-bio');
        if (bioEl) bioEl.textContent = SITE_CONFIG.homeBio;
      }
      syncAvatarFavicon();
    })
    .catch(function () { /* 后端不可达时保持内置配置 */ })
    .then(function () { SITE_CONFIG.siteReady = true; });
})();

// 部署版本徽标：读取 CF Pages Functions 的 /version（部署 id），悬停显示小弹窗
(function showDeployVersion() {
  var wrap = document.getElementById('deploy-version');
  var textEl = document.getElementById('deploy-version-text');
  var tipEl = document.getElementById('deploy-tip');
  if (!wrap || !textEl) return;
  fetch('/version', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.version) return;
      var version = String(data.version);
      textEl.textContent = version;
      var lines = ['部署版本 ' + version];
      if (data.commit) lines.push('提交 ' + String(data.commit).slice(0, 7));
      if (data.branch) lines.push('分支 ' + data.branch);
      if (tipEl) tipEl.textContent = lines.join(' · ');
      wrap.hidden = false;
      wrap.title = lines.join('\n');
    })
    .catch(function () { /* 本地直开 / 无 Functions 时静默隐藏 */ });
})();

var icpEl = document.getElementById('site-icp');
if (SITE_CONFIG.icpText) {
  icpEl.textContent = SITE_CONFIG.icpText;
} else {
  icpEl.style.display = 'none';
}

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
    if (!res.ok) throw new Error('HTTP ' + res.status);
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
  if (!items.length) return '';
  return '<div class="home-socials">' + items.join('') + '</div>';
}

var commentBox = {
  currentPostId: '',
  captchaToken: '',
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

  refreshCaptcha: async function () {
    var qEl = document.getElementById('captcha-question');
    if (!qEl) return;
    qEl.textContent = '加载中...';
    try {
      var base = SITE_CONFIG.apiBaseUrl.replace(/\/+$/, '');
      var res = await fetch(base + '/api/captcha?_t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      var data = await res.json();
      this.captchaToken = data.token || '';
      qEl.textContent = (data.question || '? + ? =') + ' (点击换一题)';
    } catch (e) {
      qEl.textContent = '验证码加载失败，点击重试';
    }
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
    var authorEl = document.getElementById('comment-author');
    var contactEl = document.getElementById('comment-contact');
    var contentEl = document.getElementById('comment-content');
    var answerEl = document.getElementById('captcha-answer');
    var hpEl = document.getElementById('comment-hp');
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
    if (!answer) {
      msgEl.textContent = '请填写算术题计算结果';
      return;
    }

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
          website_hp: honeypot
        })
      });
      var resData = await res.json();
      if (!res.ok || !resData.ok) {
        msgEl.textContent = resData.error || '提交失败，请重试';
        btnEl.disabled = false;
        this.refreshCaptcha();
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
    }
  }
};

var router = {
  current: 'home',
  searchQuery: '',
  cachedPosts: [],
  probeRefreshTimer: null,
  probeRequestId: 0,

  // ---------- 真实路径路由：每个页面 / 每篇文章拥有独立、可抓取、可分享的地址 ----------
  // 支持：/  /posts  /moments  /tools  /probe  /status  /quirky  /post/<id>
  // 服务端（CF Pages Functions）会对这些路径返回预渲染 HTML，本文件负责接管交互（水合）。
  KNOWN_TABS: ['home', 'posts', 'moments', 'tools', 'probe', 'status', 'quirky'],

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
  },

  renderPostRoute: async function (id) {
    var pre = window.__PRERENDERED_POST__;
    var container = document.getElementById('page-content');
    if (pre && String(pre.id) === String(id) && container && container.querySelector('.article-reader')) {
      this.current = 'post';
      this.syncDock('post');
      container.classList.add('is-reading');
      window.scrollTo(0, 0);
      commentBox.loadSection(pre.id);
      return;
    }
    await this.renderPost(id);
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
    this.progressEnd();
  },

  handlePopState: function () {
    this.applyRoute();
  },

  progressStart: function () {
    var p = document.getElementById('nav-progress');
    var b = document.getElementById('nav-progress-bar');
    p.setAttribute('data-active', 'true');
    b.style.width = '65%';
  },
  progressEnd: function () {
    var p = document.getElementById('nav-progress');
    var b = document.getElementById('nav-progress-bar');
    b.style.width = '100%';
    setTimeout(function () {
      p.setAttribute('data-active', 'false');
      b.style.width = '0%';
    }, 220);
  },

  waitSiteReady: function () {
    if (SITE_CONFIG.siteReady) return Promise.resolve();
    return SITE_CONFIG.siteReadyPromise || Promise.resolve();
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
    if (!skipUrl) this.syncUrl(tab === 'home' ? '/' : '/' + moduleRoute(tab));
    var navEls = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < navEls.length; i++) {
      if (navEls[i].getAttribute('data-nav') === tab) {
        navEls[i].setAttribute('aria-current', 'page');
      } else {
        navEls[i].removeAttribute('aria-current');
      }
    }

    var container = document.getElementById('page-content');
    container.classList.remove('is-reading');
    this.progressStart();

    if (tab === 'home') {
      container.innerHTML =
        '<section class="home-minimal">' +
          '<h1 class="home-title">' + escapeHtml(SITE_CONFIG.homeTitle) + '</h1>' +
          '<p class="home-bio">' + escapeHtml(SITE_CONFIG.homeBio) + '</p>' +
          renderHomeSocials() +
        '</section>';
      this.progressEnd();
      syncClient.pingBackend();
      return;
    }

    if (tab === 'posts') {
      var cached = sortNewestFirst(syncClient.getCache('posts').data);
      if (cached.length) {
        this.cachedPosts = cached;
        this.renderPostsView(container, cached);
      }
      var fresh = sortNewestFirst(await syncClient.fetchModule('posts'));
      this.cachedPosts = fresh;
      if (this.current === 'posts') this.renderPostsView(container, fresh);
      this.progressEnd();
      return;
    }

    if (tab === 'moments') {
      var cachedM = sortNewestFirst(syncClient.getCache('moments').data);
      if (cachedM.length) this.renderMomentsView(container, cachedM);
      var freshM = sortNewestFirst(await syncClient.fetchModule('moments'));
      if (this.current === 'moments') this.renderMomentsView(container, freshM);
      this.progressEnd();
      return;
    }

    if (tab === 'tools') {
      var cachedT = syncClient.getCache('tools').data;
      if (cachedT.length) this.renderToolsView(container, cachedT);
      var freshT = await syncClient.fetchModule('tools');
      if (this.current === 'tools') this.renderToolsView(container, freshT);
      this.progressEnd();
      return;
    }

    if (tab === 'probe') {
      this.renderProbeView(container);
      this.progressEnd();
      return;
    }

    if (tab === 'status') {
      var cachedS = syncClient.getCache('status').data;
      this.renderStatusView(container, cachedS);
      var freshS = await syncClient.fetchModule('status');
      if (this.current === 'status') this.renderStatusView(container, freshS);
      this.progressEnd();
      return;
    }

    if (tab === 'quirky') {
      var cachedQ = syncClient.getCache('quirky').data;
      this.renderQuirkyView(container, cachedQ);
      var freshQ = await syncClient.fetchModule('quirky');
      if (this.current === 'quirky') this.renderQuirkyView(container, freshQ);
      this.progressEnd();
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
    if (!needle) return posts;
    var out = [];
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      var hay = String(p.title || '') + ' ' + String(p.excerpt || p.content || '') + ' ' + String(p.tag || '');
      if (hay.toLowerCase().indexOf(needle) !== -1) out.push(p);
    }
    return out;
  },

  buildPostRows: function (list) {
    if (!list.length) return '<div class="empty-box">没有匹配的文章</div>';
    var html = '<ul class="post-list">';
    for (var k = 0; k < list.length; k++) {
      var item = list[k];
      html +=
        '<li class="post-row">' +
          '<a class="post-row-link" href="/post/' + encodeURIComponent(String(item.id)) + '" onclick="router.openPost(\'' + escapeHtml(item.id) + '\');return false;">' +
            '<div class="post-row-top">' +
              '<h2 class="post-row-title">' + escapeHtml(item.title) + '</h2>' +
              '<time class="post-row-date">' + escapeHtml(item.date || '') + '</time>' +
            '</div>' +
            '<p class="post-row-firstline">' + escapeHtml(item.excerpt || extractFirstLine(item.content)) + '</p>' +
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
    if (!this.cachedPosts || !this.cachedPosts.length) {
      try {
        this.cachedPosts = sortNewestFirst(await syncClient.fetchModule('posts'));
      } catch (e) {
        this.cachedPosts = [];
      }
    }
    var post = null;
    for (var i = 0; i < this.cachedPosts.length; i++) {
      if (String(this.cachedPosts[i].id) === String(id)) {
        post = this.cachedPosts[i];
        break;
      }
    }
    if (!post) {
      this.go('posts');
      return;
    }
    // /api/sync 匿名只回摘要（无 content），正文单独取，否则文章页只剩标题
    if (!post.content) {
      try {
        var fullPost = await syncClient.fetchPost(post.id);
        if (fullPost && fullPost.content) {
          post = Object.assign({}, post, fullPost);
          for (var c = 0; c < this.cachedPosts.length; c++) {
            if (String(this.cachedPosts[c].id) === String(post.id)) {
              this.cachedPosts[c] = Object.assign({}, this.cachedPosts[c], { content: fullPost.content });
              break;
            }
          }
        }
      } catch (e) {}
    }
    this.current = 'post';
    this.syncDock('post');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var container = document.getElementById('page-content');
    container.classList.add('is-reading');
    container.innerHTML =
      '<article class="article-reader">' +
        '<button class="back-btn" onclick="router.go(\'posts\')">← 返回文章列表</button>' +
        '<h1 class="reader-title">' + escapeHtml(post.title) + '</h1>' +
        '<div class="reader-meta">' + escapeHtml(post.date || '') + '</div>' +
        '<div class="reader-content">' + renderMarkdown(post.content) + '</div>' +
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
      listHtml = '<div class="empty-box">暂无碎碎念动态</div>';
    }
    container.innerHTML = '<div class="module-header"><h1 class="module-title">碎碎念</h1></div>' + listHtml;
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
          '<a href="' + escapeHtml(SITE_CONFIG.probeUrl) + '" target="_blank" rel="noopener noreferrer">打开监控后台 ↗</a>' +
          '<button type="button" onclick="router.refreshProbeView()" aria-label="刷新服务器状态" title="刷新服务器状态">刷新</button>' +
        '</div>' +
      '</div>' +
      '<div class="probe-content" id="probe-content"><div class="empty-box">正在读取服务器状态…</div></div>';
    this.refreshProbeView();
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
      if (!Array.isArray(payload.servers)) throw new Error('Invalid monitor response');
      if (this.current === 'probe' && requestId === this.probeRequestId) this.renderProbeServers(container, payload.servers);
    } catch (err) {
      if (this.current === 'probe' && requestId === this.probeRequestId) {
        container.innerHTML = '<div class="empty-box">暂时无法读取服务器状态，请稍后重试。</div>';
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

  renderProbeServers: function (container, servers) {
    if (!servers.length) {
      container.innerHTML = '<div class="empty-box">暂无公开服务器</div>';
      return;
    }

    var onlineCount = 0;
    var cards = '';
    for (var i = 0; i < servers.length; i++) {
      var server = servers[i];
      var lastUpdated = Number(server.last_updated);
      var reportAge = Date.now() - lastUpdated;
      var hasOnlineStatus = typeof server.is_online === 'boolean' || server.is_online === 0 || server.is_online === 1 || server.is_online === '0' || server.is_online === '1';
      var online = hasOnlineStatus
        ? server.is_online === true || server.is_online === 1 || server.is_online === '1'
        : Number.isFinite(lastUpdated) && lastUpdated > 0 && reportAge >= -60000 && reportAge <= 5 * 60 * 1000;
      if (online) onlineCount += 1;
      var cpu = Number(server.cpu);
      var ramTotal = Number(server.ram_total);
      var ramUsed = Number(server.ram_used);
      var diskTotal = Number(server.disk_total);
      var diskUsed = Number(server.disk_used);
      var networks = [
        ['电信', server.ping_ct], ['联通', server.ping_cu],
        ['移动', server.ping_cm], ['BGP', server.ping_bd]
      ];
      var pingHtml = '';
      for (var n = 0; n < networks.length; n++) {
        var pingValue = Number(networks[n][1]);
        if (Number.isFinite(pingValue) && pingValue >= 0) {
          pingHtml += '<span><small>' + networks[n][0] + '</small>' + pingValue.toFixed(0) + ' ms</span>';
        }
      }
      var memoryLabel = Number.isFinite(ramTotal) && ramTotal > 0
        ? (ramUsed / 1024).toFixed(1) + ' / ' + (ramTotal / 1024).toFixed(1) + ' GB'
        : '--';
      var diskLabel = Number.isFinite(diskTotal) && diskTotal > 0
        ? Math.round((diskUsed / diskTotal) * 100) + '%'
        : '--';
      var networkLabel = Number.isFinite(Number(server.net_in_speed)) && Number.isFinite(Number(server.net_out_speed))
        ? '↓ ' + formatProbeSpeed(server.net_in_speed) + ' · ↑ ' + formatProbeSpeed(server.net_out_speed)
        : '--';
      var checked = lastUpdated > 0
        ? new Date(lastUpdated).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
        : '等待上报';

      cards +=
        '<article class="probe-server-card">' +
          '<div class="probe-server-heading">' +
            '<div><h2>' + escapeHtml(server.name || '未命名服务器') + '</h2><span>' + escapeHtml(server.region || server.server_group || '未标记区域') + '</span></div>' +
            '<span class="probe-state" data-online="' + (online ? 'true' : 'false') + '"><i></i>' + (online ? '在线' : '离线') + '</span>' +
          '</div>' +
          '<div class="probe-metrics">' +
            '<div><small>CPU</small><strong>' + (Number.isFinite(cpu) ? cpu.toFixed(1) + '%' : '--') + '</strong></div>' +
            '<div><small>内存</small><strong>' + escapeHtml(memoryLabel) + '</strong></div>' +
            '<div><small>磁盘</small><strong>' + escapeHtml(diskLabel) + '</strong></div>' +
            '<div><small>网络吞吐</small><strong>' + escapeHtml(networkLabel) + '</strong></div>' +
          '</div>' +
          (pingHtml ? '<div class="probe-ping-list">' + pingHtml + '</div>' : '') +
          '<div class="probe-server-updated">最近上报 ' + escapeHtml(checked) + '</div>' +
        '</article>';
    }

    var overviewState = onlineCount === servers.length ? 'true' : (onlineCount ? 'warn' : 'false');
    container.innerHTML =
      '<div class="probe-overview"><strong><i data-state="' + overviewState + '"></i>' + onlineCount + ' / ' + servers.length + ' 台服务器在线</strong><span>每 30 秒自动更新 · 数据由 CF-Server-Monitor 提供</span></div>' +
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

// 首次进入：先等站点配置（栏目路径 / 开关），再按真实路径（/posts、/post/<id> 等）深链渲染，
// 否则自定义路径（如 /diary）会在配置到达前被误判成首页。
(SITE_CONFIG.siteReadyPromise || Promise.resolve()).then(function () {
  return router.applyRoute();
}, function () {
  return router.applyRoute();
});
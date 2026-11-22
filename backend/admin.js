document.getElementById('year').textContent = String(new Date().getFullYear());

function getVerifiedBadgeSvg() {
  return '<span class="verified-badge" title="站长认证徽章">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path class="verified-badge-bg" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/>' +
      '<path class="verified-badge-check" d="M8.5 12.5l2.5 2.5 5-5.5"/>' +
    '</svg>' +
  '</span>';
}

function syncAvatarFavicon() {
  var avatarEl = document.getElementById('admin-avatar');
  var charText = String(avatarEl ? avatarEl.textContent : 'S').trim().slice(0, 2);
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bg = isDark ? '%23F4F4F5' : '%23141416';
  var fg = isDark ? '%23141416' : '%23FFFFFF';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34">' +
    '<rect width="34" height="34" rx="7" fill="' + bg + '"/>' +
    '<text x="50%" y="53%" dominant-baseline="central" text-anchor="middle" fill="' + fg + '" font-family="monospace" font-weight="600" font-size="18">' +
    encodeURIComponent(charText) +
    '</text></svg>';
  var link = document.getElementById('dynamic-favicon');
  if (link) link.href = 'data:image/svg+xml,' + svg;
}

// 侧边栏头像文字 + favicon 同步（头像文字最多 2 字，空则回退 S）
function setSidebarAvatar(text) {
  var el = document.getElementById('admin-avatar');
  var value = String(text || '').trim().slice(0, 2);
  if (el) el.textContent = value || 'S';
  syncAvatarFavicon();
}

// 把 date 解析为毫秒（北京时间锚定），失败回退 mtime —— 与前台排序保持一致
function adminDateMsOf(item) {
  var raw = String((item && item.date) || '').trim();
  if (raw) {
    var iso = raw.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso += 'T00:00:00+08:00';
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(iso)) iso += '+08:00';
    var ms = Date.parse(iso);
    if (!isNaN(ms)) return ms;
  }
  return Number(item && item.mtime) || 0;
}

function sortNewestFirst(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().sort(function (a, b) {
    var da = adminDateMsOf(a);
    var db = adminDateMsOf(b);
    if (db !== da) return db - da;
    var ma = Number(a && a.mtime) || 0;
    var mb = Number(b && b.mtime) || 0;
    if (mb !== ma) return mb - ma;
    return String((b && b.id) || '').localeCompare(String((a && a.id) || ''));
  });
}

var SCHEMAS = {
  posts: {
    label: '文章',
    storageHint: '存储: ./article/*/*.md | 评论: ./article/*/comments.json',
    fields: [
      { key: 'title', label: '文章标题', type: 'text', placeholder: '输入文章标题...' },
      { key: 'id', label: '文件夹与文件名标识 (可选，如 hello-world，留空自动用标题生成)', type: 'text', placeholder: '支持中文、字母、数字、短横线' },
      { key: 'date', label: '发布日期', type: 'text', placeholder: 'YYYY-MM-DD (留空自动生成)' },
      { key: 'content', label: 'Markdown 正文 (首行文字作为摘要)', type: 'textarea', uploadable: true, placeholder: '第一行写摘要文字...\n\n支持直接拖入图片或 Ctrl+V 粘贴图片自动上传...\n\n## 二级标题\n正文内容...' }
    ]
  },
  moments: {
    label: '碎碎念',
    storageHint: '存储: ./Musings/*.md | 图片: ./img/日期/ | 文件: ./file/日期/',
    fields: [
      { key: 'tag', label: '标签 (可选)', type: 'text', placeholder: '例如：日常 / 折腾' },
      { key: 'date', label: '发布时间', type: 'text', placeholder: 'YYYY-MM-DD HH:mm (留空自动生成)' },
      { key: 'content', label: '瞬间内容 (支持拖入图片或上传文件)', type: 'textarea', uploadable: true, placeholder: '记录当下的想法（支持直接拖入图片自动转 Markdown）...' }
    ]
  },
  comments: {
    label: '评论审核与回复',
    storageHint: '存储: ./article/*/comments.json (支持多级层中层评论审核与回复)',
    fields: []
  },
  tools: {
    label: '工具',
    storageHint: '存储路径: ./config.json (tools)',
    fields: [
      { key: 'title', label: '网站名称', type: 'text', placeholder: '例如：Cloudflare' },
      { key: 'url', label: '网站链接', type: 'text', placeholder: 'https://...' },
      { key: 'icon', label: '图标 URL (可选，留空自动取首字母)', type: 'text', placeholder: 'https://.../favicon.ico' },
      { key: 'desc', label: '用途说明', type: 'text', placeholder: '简短描述该工具的用途...' }
    ]
  },
  status: {
    label: '状态监控',
    storageHint: '后端每 60 秒真实探测目标 URL 是否返回 HTTP 200',
    fields: [
      { key: 'name', label: '监控站点 / 服务名称', type: 'text', placeholder: '例如：主站 Blog / API 节点' },
      { key: 'url', label: '要探测的网页 URL (后端将自动发起请求检测是否为 200)', type: 'text', placeholder: 'https://example.com' },
      { key: 'expectedCode', label: '期望 HTTP 状态码 (默认 200)', type: 'text', placeholder: '200' }
    ]
  },
  quirky: {
    label: '奇奇怪怪',
    storageHint: '存储路径: ./config.json (quirky)',
    fields: [
      { key: 'title', label: '项目名称', type: 'text', placeholder: '输入实验项目标题...' },
      { key: 'url', label: '访问地址', type: 'text', placeholder: 'https://...' },
      { key: 'desc', label: '简短介绍', type: 'text', placeholder: '这个奇怪小玩具是做什么的...' }
    ]
  }
};

/* ===== WebAuthn 编解码：ArrayBuffer <-> base64url ===== */
function b64uToBuffer(value) {
  var s = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  var pad = s.length % 4;
  if (pad) s += '===='.slice(0, 4 - pad);
  var bin = atob(s);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64u(buffer) {
  var bytes = new Uint8Array(buffer);
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 前台栏目：内置图标（与前端 app.js 的 ICON_SVGS 保持一致）
var MODULE_ICON_ORDER = ['home', 'book', 'message', 'wrench', 'activity', 'heart', 'star', 'code', 'camera', 'music', 'globe', 'folder', 'link', 'zap', 'coffee', 'image'];

var MODULE_ICON_SVGS = {
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

var MODULE_FALLBACK = {
  home: { name: '首页', icon: 'home' },
  posts: { name: '文章', icon: 'book' },
  moments: { name: '碎碎念', icon: 'message' },
  links: { name: '友链', icon: 'link' },
  tools: { name: '工具', icon: 'wrench' },
  probe: { name: '探针', icon: 'activity' },
  status: { name: '状态', icon: 'heart' },
  quirky: { name: '奇奇怪怪', icon: 'star' }
};

var MODULE_ORDER = ['home', 'posts', 'moments', 'links', 'tools', 'probe', 'status', 'quirky'];

// 栏目顺序：只保留已知 key、去重，缺的按默认顺序补在末尾
function normalizeModuleOrder(raw) {
  var out = [];
  (Array.isArray(raw) ? raw : []).forEach(function (k) {
    var key = String(k || '').trim();
    if (MODULE_ORDER.indexOf(key) !== -1 && out.indexOf(key) === -1) out.push(key);
  });
  MODULE_ORDER.forEach(function (key) {
    if (out.indexOf(key) === -1) out.push(key);
  });
  return out;
}

// 图标值可能是预设名，也可能是 /img/... 或 http(s) 地址
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escAttr(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function moduleIconHtml(icon, fallbackId) {
  var key = String(icon || '').trim();
  var preset = MODULE_ICON_SVGS[key] ? key : (MODULE_ICON_SVGS[fallbackId] ? fallbackId : 'book');
  if (key && key !== preset && (key.charAt(0) === '/' || /^https?:\/\//i.test(key))) {
    return '<img src="' + key.replace(/"/g, '&quot;') + '" alt="" />';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + MODULE_ICON_SVGS[preset] + '</svg>';
}

var cms = {
  mod: 'posts',
  modules: null,
  order: MODULE_ORDER.slice(),
  iconTarget: null,
  dragKey: '',
  markdownMode: 'content',
  store: { posts: [], moments: [], comments: [], tools: [], status: [], quirky: [] },
  currentItem: null,
  authed: false,

  init: async function () {
    var mode = localStorage.getItem('site-theme-mode') || 'auto';
    this.setTheme(mode);
    this.bindUploadInputs();
    this.renderForm();
    this.bindAuthForms();
    this.bindSettings();
    document.getElementById('passkey-login-btn').addEventListener('click', function () {
      cms.passkeyLogin();
    });
    await this.bootstrapAuth();
  },

  getApiUrl: function (pathStr) {
    return window.location.origin.replace(/\/+$/, '') + pathStr;
  },

  // ---------- 认证流程（Cookie 会话，凭据不出 HttpOnly Cookie，前端不可读取） ----------

  bootstrapAuth: async function () {
    try {
      var res = await fetch(this.getApiUrl('/api/auth/status?_t=' + Date.now()), { cache: 'no-store' });
      var data = await res.json();
      if (data.setupNeeded) {
        this.showAuthOverlay('setup');
        return;
      }
      if (data.authed) {
        this.authed = true;
        this.enterConsole(data.username);
        return;
      }
      this.showAuthOverlay('login');
    } catch (e) {
      // 后端不可达：仍展示登录层，便于网络恢复后直接重试
      this.showAuthOverlay('login');
      this.notify('无法连接后端服务');
    }
  },

  showAuthOverlay: function (mode) {
    this.authed = false;
    var overlay = document.getElementById('auth-overlay');
    overlay.setAttribute('data-mode', mode === 'setup' ? 'setup' : 'login');
    overlay.style.display = 'flex';
    var isSetup = mode === 'setup';
    document.getElementById('auth-sub').textContent = isSetup ? '首次部署：创建管理员账户' : '账号密码登录后台管理';
    document.getElementById('auth-login-form').style.display = isSetup ? 'none' : 'block';
    document.getElementById('auth-setup-form').style.display = isSetup ? 'block' : 'none';
    document.getElementById('login-error').textContent = '';
    document.getElementById('setup-error').textContent = '';
    document.getElementById('login-totp-field').hidden = true;
    document.getElementById('login-totp').value = '';
    if (!isSetup) this.probePasskeyLogin();
    setTimeout(function () {
      var focusEl = document.getElementById(isSetup ? 'setup-username' : 'login-username');
      if (focusEl) focusEl.focus();
    }, 60);
  },

  hideAuthOverlay: function () {
    document.getElementById('auth-overlay').style.display = 'none';
  },

  enterConsole: function (username) {
    this.authed = true;
    this.hideAuthOverlay();
    document.getElementById('auth-username').textContent = username || 'admin';
    this.loadAll();
    // 侧边栏按「前台栏目」配置显示 / 隐藏（不需要先打开管理页）
    this.loadSettings().catch(function () { /* 忽略：管理数据拉取失败不影响主流程 */ });
    this.loadDeployVersion();
  },

  handle401: function () {
    if (!this.authed) return;
    this.notify('登录状态已失效，请重新登录');
    this.showAuthOverlay('login');
  },

  bindAuthForms: function () {
    var self = this;

    document.getElementById('auth-login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var errEl = document.getElementById('login-error');
      errEl.textContent = '';
      var username = document.getElementById('login-username').value.trim();
      var password = document.getElementById('login-password').value;
      var totpEl = document.getElementById('login-totp');
      var totpCode = totpEl.value.trim();
      if (!username || !password) {
        errEl.textContent = '请输入用户名和密码';
        return;
      }
      try {
        var res = await fetch(self.getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password, totpCode: totpCode })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          // 密码正确但缺两步验证码：展开验证码输入框，不提示密码错误
          if (data && data.needTotp) {
            document.getElementById('login-totp-field').hidden = false;
            errEl.textContent = data.error || '请输入两步验证码';
            totpEl.value = '';
            totpEl.focus();
            return;
          }
          errEl.textContent = (data && data.error) ? data.error : ('登录失败 (HTTP ' + res.status + ')');
          return;
        }
        document.getElementById('login-password').value = '';
        totpEl.value = '';
        document.getElementById('login-totp-field').hidden = true;
        self.enterConsole(data.username);
      } catch (err) {
        errEl.textContent = '网络错误：请确认后端服务是否可达';
      }
    });

    document.getElementById('auth-setup-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var errEl = document.getElementById('setup-error');
      errEl.textContent = '';
      var username = document.getElementById('setup-username').value.trim();
      var password = document.getElementById('setup-password').value;
      var password2 = document.getElementById('setup-password2').value;
      if (!username || !password) {
        errEl.textContent = '请输入用户名和密码';
        return;
      }
      if (password.length < 8) {
        errEl.textContent = '密码长度至少 8 位';
        return;
      }
      if (password !== password2) {
        errEl.textContent = '两次输入的密码不一致';
        return;
      }
      try {
        var res = await fetch(self.getApiUrl('/api/auth/setup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          errEl.textContent = (data && data.error) ? data.error : ('初始化失败 (HTTP ' + res.status + ')');
          return;
        }
        self.enterConsole(data.username);
      } catch (err) {
        errEl.textContent = '网络错误：请确认后端服务是否可达';
      }
    });
  },

  logout: async function () {
    try {
      await fetch(this.getApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    } catch (e) {}
    location.reload();
  },

  openPasswordModal: function () {
    if (!this.authed) return;
    ['pw-current', 'pw-new', 'pw-new2'].forEach(function (id) { document.getElementById(id).value = ''; });
    document.getElementById('pw-error').textContent = '';
    document.getElementById('password-modal').style.display = 'flex';
    setTimeout(function () { document.getElementById('pw-current').focus(); }, 60);
  },

  closePasswordModal: function () {
    document.getElementById('password-modal').style.display = 'none';
  },

  submitPasswordChange: async function () {
    var errEl = document.getElementById('pw-error');
    errEl.textContent = '';
    var current = document.getElementById('pw-current').value;
    var next = document.getElementById('pw-new').value;
    var next2 = document.getElementById('pw-new2').value;

    if (!current || !next) {
      errEl.textContent = '请填写当前密码与新密码';
      return;
    }
    if (next.length < 8) {
      errEl.textContent = '新密码长度至少 8 位';
      return;
    }
    if (next !== next2) {
      errEl.textContent = '两次输入的新密码不一致';
      return;
    }

    try {
      var res = await fetch(this.getApiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        errEl.textContent = (data && data.error) ? data.error : ('修改失败 (HTTP ' + res.status + ')');
        return;
      }
      this.closePasswordModal();
      this.notify('密码已修改，其它设备登录状态已吊销');
    } catch (err) {
      errEl.textContent = '网络错误：请确认后端服务是否可达';
    }
  },

  refreshData: async function () {
    if (!this.authed) return;
    await this.loadAll();
    this.notify('数据已同步');
  },

  setTheme: function (mode) {
    localStorage.setItem('site-theme-mode', mode);
    var isLight = mode === 'light' ? true : (mode === 'dark' ? false : window.matchMedia('(prefers-color-scheme: light)').matches);
    var resolved = isLight ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.style.colorScheme = resolved;
    var btns = document.querySelectorAll('.theme-option');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-mode') === mode ? 'true' : 'false');
    }
    syncAvatarFavicon();
  },

  notify: function (msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  },

  bindUploadInputs: function () {
    var self = this;
    var imgInput = document.getElementById('hidden-img-input');
    var fileInput = document.getElementById('hidden-file-input');

    imgInput.addEventListener('change', async function () {
      var files = imgInput.files;
      if (!files || !files.length) return;
      for (var i = 0; i < files.length; i++) {
        if (files[i].type.indexOf('image/') !== 0) {
          self.notify('仅限选择图片文件');
          continue;
        }
        await self.uploadFileAndInsert(files[i], 'image');
      }
      imgInput.value = '';
    });

    fileInput.addEventListener('change', async function () {
      var files = fileInput.files;
      if (!files || !files.length) return;
      for (var i = 0; i < files.length; i++) {
        await self.uploadFileAndInsert(files[i], 'file');
      }
      fileInput.value = '';
    });
  },

  triggerImageSelect: function () {
    document.getElementById('hidden-img-input').click();
  },

  triggerFileSelect: function () {
    document.getElementById('hidden-file-input').click();
  },

  uploadFileAndInsert: function (fileObj, kind) {
    var self = this;
    return new Promise(function (resolve) {
      if (!self.authed) {
        self.notify('请先登录');
        return resolve();
      }

      var statusEl = document.getElementById('upload-status-text');
      if (statusEl) statusEl.textContent = '正在上传: ' + fileObj.name + ' ...';
      self.notify('正在上传 ' + fileObj.name + ' ...');

      var reader = new FileReader();
      reader.onload = async function (e) {
        try {
          var res = await fetch(self.getApiUrl('/api/upload'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: kind,
              filename: fileObj.name,
              data: e.target.result
            })
          });

          if (res.status === 401) { self.handle401(); return resolve(); }
          if (!res.ok) throw new Error('Upload failed');
          var data = await res.json();
          self.insertAtCursor('field-content', data.markdown);
          if (statusEl) {
            statusEl.textContent = '已保存至: ' + data.relativeUrl;
          }
          self.notify((kind === 'image' ? '图片' : '文件') + '上传成功，已插入 Markdown');
        } catch (err) {
          if (statusEl) statusEl.textContent = '上传失败，请检查登录状态或文件大小';
          self.notify('上传失败：请确认登录状态是否有效');
        }
        resolve();
      };
      reader.onerror = function () {
        self.notify('读取本地文件失败');
        resolve();
      };
      reader.readAsDataURL(fileObj);
    });
  },

  insertAtCursor: function (textareaId, textToInsert) {
    var ta = document.getElementById(textareaId);
    if (!ta) return;
    var start = ta.selectionStart || 0;
    var end = ta.selectionEnd || 0;
    var before = ta.value.slice(0, start);
    var after = ta.value.slice(end);
    var prefix = (before.length > 0 && before.slice(-1) !== '\n') ? '\n' : '';
    var suffix = (after.length > 0 && after.slice(0, 1) !== '\n') ? '\n' : '';
    var fullInsert = prefix + textToInsert + suffix;

    ta.value = before + fullInsert + after;
    var newPos = start + fullInsert.length;
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  },

  setMarkdownMode: function (mode) {
    this.markdownMode = mode;
    var workspace = document.getElementById('markdown-workspace');
    if (!workspace) return;
    workspace.setAttribute('data-mode', mode);
    var buttons = document.querySelectorAll('.markdown-mode-btn');
    for (var i = 0; i < buttons.length; i++) {
      var isActive = buttons[i].getAttribute('data-mode') === mode;
      buttons[i].classList.toggle('active', isActive);
      buttons[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  },

  bindMarkdownEditor: function () {
    var textarea = document.getElementById('field-content');
    var preview = document.getElementById('markdown-preview-content');
    if (!textarea || !preview) return;
    var updatePreview = function () {
      preview.innerHTML = renderMarkdown(textarea.value);
    };
    textarea.addEventListener('input', updatePreview);
    updatePreview();
    this.setMarkdownMode(this.markdownMode);
  },

  bindTextareaDropzone: function () {
    var self = this;
    var ta = document.getElementById('field-content');
    if (!ta) return;

    ta.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      ta.classList.add('drag-over');
    });

    ta.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      ta.classList.remove('drag-over');
    });

    ta.addEventListener('drop', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      ta.classList.remove('drag-over');

      var files = e.dataTransfer ? e.dataTransfer.files : null;
      if (!files || !files.length) return;

      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!f.type || f.type.indexOf('image/') !== 0) {
          self.notify('拖入仅限图片文件！普通文件请点击右上角「上传文件」按钮');
          continue;
        }
        await self.uploadFileAndInsert(f, 'image');
      }
    });

    ta.addEventListener('paste', async function (e) {
      var items = (e.clipboardData && e.clipboardData.items) ? e.clipboardData.items : [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
          e.preventDefault();
          var blob = items[i].getAsFile();
          if (blob) {
            await self.uploadFileAndInsert(blob, 'image');
          }
        }
      }
    });
  },

  updateCommentCountBadge: function () {
    var list = this.store.comments || [];
    var pendingCount = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].status !== 'approved') pendingCount++;
    }
    var el = document.getElementById('count-comments');
    if (el) {
      el.textContent = pendingCount > 0 ? ('待审 ' + pendingCount + ' / ' + list.length) : String(list.length);
      el.style.color = pendingCount > 0 ? 'var(--status-warn)' : 'var(--text-muted)';
    }
  },

  loadAll: async function () {
    var badge = document.getElementById('conn-badge');
    var stateEl = document.getElementById('conn-state');
    stateEl.textContent = 'SYNCING';
    try {
      var keys = Object.keys(SCHEMAS);
      for (var i = 0; i < keys.length; i++) {
        var m = keys[i];
        var res = await fetch(this.getApiUrl('/api/sync?module=' + m + '&version=&_t=' + Date.now()), {
          cache: 'no-store'
        });
        if (res.status === 401) {
          this.handle401();
          badge.setAttribute('data-status', 'offline');
          stateEl.textContent = 'OFFLINE';
          return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        var arr = Array.isArray(data.data) ? data.data : [];
        if (m === 'posts' || m === 'moments' || m === 'comments') {
          arr = sortNewestFirst(arr);
        }
        this.store[m] = arr;
        if (m === 'comments') {
          this.updateCommentCountBadge();
        } else {
          document.getElementById('count-' + m).textContent = String(this.store[m].length);
        }
      }
      badge.setAttribute('data-status', 'online');
      stateEl.textContent = 'ONLINE';
      this.renderList();
    } catch (e) {
      badge.setAttribute('data-status', 'offline');
      stateEl.textContent = 'OFFLINE';
    }
  },

  switchMod: function (m) {
    this.mod = m;
    this.currentItem = null;
    var btns = document.querySelectorAll('#mod-nav .nav-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-mod') === m);
    }

    // 「管理」「探针」都是独立页面，不参与列表 / 编辑器布局
    this.closeSettingsMenu();

    var PAGES = { settings: 'admin-settings', probe: 'admin-probe', links: 'admin-links', notify: 'admin-notify' };
    var pageId = PAGES[m] || '';
    var grid = document.querySelector('.cms-grid');
    if (grid) grid.style.display = pageId ? 'none' : '';
    ['admin-settings', 'admin-probe', 'admin-links', 'admin-notify'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = (id !== pageId);
    });
    // 二级菜单高亮只在「正在看哪个区块」时存在，切到其它页面一律清空
    if (m === 'settings') {
      var self2 = this;
      setTimeout(function () { self2.syncSubnavActive(); }, 0);
    } else {
      this.subnavTarget = '';
      this.clearSubnavActive();
    }

    // 存储路径提示只属于内容类页面，独立页面不显示
    var hintEl = document.getElementById('storage-hint');
    if (pageId) {
      if (hintEl) hintEl.style.display = 'none';
      if (m === 'links') this.loadLinks();
      else if (m === 'notify') this.loadNotify();
      else this.loadSettings();
      return;
    }
    if (hintEl) hintEl.style.display = '';

    document.getElementById('list-title').textContent = SCHEMAS[m].label + '列表';
    document.getElementById('storage-hint').textContent = SCHEMAS[m].storageHint;
    document.getElementById('probe-now-btn').style.display = m === 'status' ? 'inline-block' : 'none';
    var memoBtn = document.getElementById('memo-telegram-btn');
    if (memoBtn) memoBtn.style.display = m === 'moments' ? 'inline-block' : 'none';
    document.getElementById('new-item-btn').style.display = m === 'comments' ? 'none' : 'inline-block';

    this.renderList();
    if (m === 'comments' && this.store.comments.length > 0) {
      this.selectByIndex(0);
    } else {
      this.renderForm();
    }
  },

  triggerProbeNow: async function () {
    try {
      this.notify('正在探测所有监控目标...');
      var res = await fetch(this.getApiUrl('/api/probe-now'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await this.loadAll();
      if (this.currentItem) {
        this.selectItem(this.currentItem.id);
      }
      this.notify('实时探测完成');
    } catch (e) {
      this.notify('探测失败：请确认登录状态是否有效');
    }
  },

  renderList: function () {
    var list = this.store[this.mod] || [];
    if (this.mod === 'posts' || this.mod === 'moments' || this.mod === 'comments') {
      list = sortNewestFirst(list);
      this.store[this.mod] = list;
    }
    var ul = document.getElementById('item-list');
    if (!list.length) {
      var emptyMsg = this.mod === 'comments' ? '暂无访客评论' : '暂无数据，点击右上角「+ 新建」';
      ul.innerHTML = '<li style="padding:32px 16px;text-align:center;color:var(--text-muted);font-size:12.5px;">' + emptyMsg + '</li>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var title = item.title || item.name || item.author || (item.content ? item.content.slice(0, 28) : '未命名条目');
      var sub = '';
      var badgeHtml = '';

      if (this.mod === 'posts') {
        sub = 'article/' + item.id + '/' + item.id + '.md · ' + (item.date || '');
      } else if (this.mod === 'moments') {
        sub = 'Musings/' + item.id + '.md · ' + (item.date || '');
      } else if (this.mod === 'comments') {
        var prefix = item.parentId ? ('[回复 @' + (item.parentAuthor || '访客') + '] ') : '';
        title = prefix + (item.author || '匿名') + ': ' + String(item.content || '').slice(0, 18);
        sub = 'article/' + (item.postId || '-') + '/comments.json · ' + (item.date || '');
        var isApproved = item.status === 'approved';
        var replyMark = item.replyContent ? ' · 已回复' : '';
        badgeHtml = '<span class="probe-badge" data-ok="' + (isApproved ? 'true' : 'warn') + '">' + (isApproved ? '已通过' : '待审核') + replyMark + '</span>';
      } else if (this.mod === 'status') {
        sub = (item.url || '') + ' · ' + (item.latency || '-- ms') + ' · SLA ' + (item.uptime || '100%');
        var isUp = item.ok !== false;
        var codeTxt = item.statusCode ? ('HTTP ' + item.statusCode) : '待探测';
        badgeHtml = '<span class="probe-badge" data-ok="' + (isUp ? 'true' : 'false') + '">' + codeTxt + '</span>';
      } else {
        sub = item.url || item.date || item.id;
      }

      var isEditing = this.currentItem && String(this.currentItem.id) === String(item.id);
      html +=
        '<li class="item-row ' + (isEditing ? 'editing' : '') + '" data-idx="' + i + '" onclick="cms.selectByIndex(' + i + ')">' +
          '<div class="item-row-top">' +
            '<div class="item-row-title">' + this.escape(title) + '</div>' +
            badgeHtml +
          '</div>' +
          '<div class="item-row-sub">' + this.escape(sub) + '</div>' +
        '</li>';
    }
    ul.innerHTML = html;
  },

  newItem: function () {
    if (this.mod === 'comments') return;
    this.currentItem = null;
    this.renderList();
    this.renderForm();
  },

  selectByIndex: function (idx) {
    var list = this.store[this.mod] || [];
    if (!list[idx]) return;
    this.currentItem = JSON.parse(JSON.stringify(list[idx]));
    this.renderList();
    this.renderForm();
  },

  selectItem: function (id) {
    var list = this.store[this.mod] || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        this.selectByIndex(i);
        return;
      }
    }
  },

  renderForm: function () {
    var schema = SCHEMAS[this.mod];
    var container = document.getElementById('form-container');

    if (this.mod === 'comments') {
      if (!this.currentItem) {
        document.getElementById('editor-title').textContent = '评论详情与回复';
        document.getElementById('editing-id').textContent = 'SELECT A COMMENT';
        container.innerHTML = '<div style="padding:40px 16px;text-align:center;color:var(--text-muted);font-size:13px;">请从左侧列表点击一条访客评论进行审核或回复</div>';
        return;
      }

      var c = this.currentItem;
      var isApproved = c.status === 'approved';
      var savedAdminName = localStorage.getItem('cms_reply_author') || c.replyAuthor || '简单博客';
      var parentInfoHtml = c.parentId
        ? '<div>层级类型：<strong>层中层子回复</strong>（回复给 <strong>@' + this.escape(c.parentAuthor || '访客') + '</strong>，父评论 ID：' + this.escape(c.parentId) + '）</div>'
        : '<div>层级类型：<strong>主评论（顶层）</strong></div>';

      document.getElementById('editor-title').textContent = '评论审核与回复';
      document.getElementById('editing-id').textContent = 'article/' + c.postId + '/comments.json';

      container.innerHTML =
        '<div class="probe-live-box">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<strong>所属文章：' + this.escape(c.postTitle || c.postId) + ' (' + this.escape(c.postId) + ')</strong>' +
            '<span class="probe-badge" data-ok="' + (isApproved ? 'true' : 'warn') + '">' + (isApproved ? '已审核通过（前端展示中）' : '待审核（前端未展示）') + '</span>' +
          '</div>' +
          parentInfoHtml +
          '<div>访客昵称：<strong>' + this.escape(c.author || '匿名') + '</strong> · 联系方式：' + this.escape(c.contact || '未填') + ' · IP：' + this.escape(c.ip || '未知') + '</div>' +
          '<div>提交时间：' + this.escape(c.date || '') + '</div>' +
          '<div style="margin-top:6px;padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;white-space:pre-wrap;font-family:var(--font-sans);font-size:14px;">' +
            this.escape(c.content || '') +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">您的回复昵称（前端将在昵称右侧自动展示黑白认证对勾 ' + getVerifiedBadgeSvg() + '）</label>' +
          '<input class="field-input" id="field-replyAuthor" type="text" value="' + this.escape(savedAdminName) + '" placeholder="例如：简单博客" />' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">站长回复内容（将以缩进子层级展示在该评论下方；留空并保存可清除回复）</label>' +
          '<textarea class="field-textarea" id="field-replyContent" style="min-height:140px;" placeholder="输入回复访客的内容...">' + this.escape(c.replyContent || '') + '</textarea>' +
        '</div>' +
        '<div class="btn-row">' +
          '<div>' +
            '<button class="btn btn-danger" onclick="cms.deleteCurrent()">删除此条评论（含子回复）</button>' +
          '</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
            (isApproved
              ? '<button class="btn" onclick="cms.saveCommentReply(\'pending\')">撤回为待审核</button>'
              : '<button class="btn btn-ok" onclick="cms.saveCommentReply(\'approved\')">✓ 通过审核</button>') +
            '<button class="btn btn-primary" onclick="cms.saveCommentReply(\'approved\')">发送回复（并自动通过审核）</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var item = this.currentItem || {};
    document.getElementById('editor-title').textContent = this.currentItem ? ('编辑' + schema.label) : ('新建' + schema.label);
    document.getElementById('editing-id').textContent = this.currentItem ? ('ID: ' + this.currentItem.id) : 'NEW';

    var fieldsHtml = '';
    for (var i = 0; i < schema.fields.length; i++) {
      var f = schema.fields[i];
      var val = item[f.key] !== undefined ? item[f.key] : '';
      var readonlyAttr = (f.key === 'id' && this.currentItem) ? 'readonly style="opacity:0.65;cursor:not-allowed;"' : '';
      if (f.type === 'textarea') {
        var toolbarHtml = f.uploadable
          ? '<div class="upload-toolbar">' +
              '<button type="button" class="upload-btn" onclick="cms.triggerImageSelect()">+ 上传图片 (img/日期)</button>' +
              '<button type="button" class="upload-btn" onclick="cms.triggerFileSelect()">+ 上传文件 (file/日期)</button>' +
            '</div>'
          : '';
        var dropHintHtml = f.uploadable
          ? '<div class="drop-hint">' +
              '<span>支持直接拖入图片或 Ctrl+V 粘贴图片上传（拖入仅限图片）</span>' +
              '<span id="upload-status-text"></span>' +
            '</div>'
          : '';
        var isMarkdownField = f.key === 'content' && (this.mod === 'posts' || this.mod === 'moments');
        if (isMarkdownField) {
          fieldsHtml +=
            '<div class="field markdown-field">' +
              '<div class="field-label-row">' +
                '<label class="field-label">' + f.label + '</label>' +
                toolbarHtml +
              '</div>' +
              '<div class="markdown-mode-tabs" role="group" aria-label="Markdown 编辑视图">' +
                '<button type="button" class="markdown-mode-btn" data-mode="content" aria-pressed="false" onclick="cms.setMarkdownMode(\'content\')">内容</button>' +
                '<button type="button" class="markdown-mode-btn" data-mode="preview" aria-pressed="false" onclick="cms.setMarkdownMode(\'preview\')">预览</button>' +
                '<button type="button" class="markdown-mode-btn" data-mode="compare" aria-pressed="false" onclick="cms.setMarkdownMode(\'compare\')">对照</button>' +
              '</div>' +
              '<div class="markdown-workspace" id="markdown-workspace" data-mode="' + this.markdownMode + '">' +
                '<div class="markdown-source"><div class="dropzone-wrap">' +
                  '<textarea class="field-textarea" id="field-' + f.key + '" placeholder="' + this.escape(f.placeholder) + '">' + this.escape(val) + '</textarea>' +
                  dropHintHtml +
                '</div></div>' +
                '<div class="markdown-preview"><div class="markdown-preview-content" id="markdown-preview-content"></div></div>' +
              '</div>' +
            '</div>';
        } else {
          fieldsHtml +=
            '<div class="field">' +
              '<div class="field-label-row">' +
                '<label class="field-label">' + f.label + '</label>' +
                toolbarHtml +
              '</div>' +
              '<div class="dropzone-wrap">' +
                '<textarea class="field-textarea" id="field-' + f.key + '" placeholder="' + this.escape(f.placeholder) + '">' + this.escape(val) + '</textarea>' +
                dropHintHtml +
              '</div>' +
            '</div>';
        }
      } else {
        fieldsHtml +=
          '<div class="field">' +
            '<label class="field-label">' + f.label + '</label>' +
            '<input class="field-input" id="field-' + f.key + '" type="text" value="' + this.escape(val) + '" placeholder="' + this.escape(f.placeholder) + '" ' + readonlyAttr + ' />' +
          '</div>';
      }
    }

    if (this.mod === 'status' && this.currentItem) {
      fieldsHtml +=
        '<div class="probe-live-box">' +
          '<div><strong>最近真实探测结果</strong></div>' +
          '<div>HTTP 状态码: ' + this.escape(this.currentItem.statusCode || '未探测') + ' (' + (this.currentItem.ok ? '正常 200' : '异常') + ')</div>' +
          '<div>响应延迟: ' + this.escape(this.currentItem.latency || '--') + ' | 在线率(SLA): ' + this.escape(this.currentItem.uptime || '100%') + '</div>' +
          '<div>最后探测时间: ' + this.escape(this.currentItem.lastChecked || '--') + '</div>' +
        '</div>';
    }

    container.innerHTML =
      fieldsHtml +
      '<div class="btn-row">' +
        '<div>' +
          (this.currentItem ? '<button class="btn btn-danger" onclick="cms.deleteCurrent()">删除此条</button>' : '') +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button class="btn" onclick="cms.newItem()">重置</button>' +
          '<button class="btn btn-primary" onclick="cms.saveCurrent()">' + (this.currentItem ? '保存修改' : '立即发布') + '</button>' +
        '</div>' +
      '</div>';

    if (this.mod === 'posts' || this.mod === 'moments') {
      this.bindMarkdownEditor();
      this.bindTextareaDropzone();
    }
  },

  saveCommentReply: async function (targetStatus) {
    if (!this.currentItem) return;
    var authorEl = document.getElementById('field-replyAuthor');
    var contentEl = document.getElementById('field-replyContent');
    var replyAuthor = authorEl ? authorEl.value.trim() : '简单博客';
    var replyContent = contentEl ? contentEl.value.trim() : '';

    if (replyAuthor) {
      localStorage.setItem('cms_reply_author', replyAuthor);
    }

    var payloadItem = {
      id: this.currentItem.id,
      postId: this.currentItem.postId,
      status: targetStatus || this.currentItem.status,
      replyAuthor: replyAuthor || '简单博客',
      replyContent: replyContent
    };

    try {
      var res = await fetch(this.getApiUrl('/api/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'comments', item: payloadItem })
      });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var resData = await res.json();
      if (Array.isArray(resData.data)) {
        this.store.comments = sortNewestFirst(resData.data);
        this.updateCommentCountBadge();
      }
      this.currentItem = resData.item || null;
      this.renderList();
      this.renderForm();
      this.notify('已保存回复与审核状态');
    } catch (err) {
      this.notify('操作失败：请确认登录状态是否有效');
    }
  },

  saveCurrent: async function () {
    var schema = SCHEMAS[this.mod];
    var payloadItem = this.currentItem ? JSON.parse(JSON.stringify(this.currentItem)) : {};
    for (var i = 0; i < schema.fields.length; i++) {
      var f = schema.fields[i];
      var el = document.getElementById('field-' + f.key);
      if (el) payloadItem[f.key] = el.value.trim();
    }

    try {
      var res = await fetch(this.getApiUrl('/api/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: this.mod, item: payloadItem })
      });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var resData = await res.json();
      if (Array.isArray(resData.data)) {
        var arr = resData.data;
        if (this.mod === 'posts' || this.mod === 'moments') {
          arr = sortNewestFirst(arr);
        }
        this.store[this.mod] = arr;
        document.getElementById('count-' + this.mod).textContent = String(arr.length);
      }
      this.currentItem = resData.item || null;
      this.renderList();
      this.renderForm();
      this.notify('已保存并更新列表');
    } catch (err) {
      this.notify('保存失败：请确认登录状态是否有效');
    }
  },

  deleteCurrent: async function () {
    if (!this.currentItem) return;
    try {
      var res = await fetch(this.getApiUrl('/api/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: this.mod,
          id: this.currentItem.id,
          postId: this.currentItem.postId || ''
        })
      });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var resData = await res.json();
      if (Array.isArray(resData.data)) {
        this.store[this.mod] = resData.data;
        if (this.mod === 'comments') {
          this.updateCommentCountBadge();
        } else {
          document.getElementById('count-' + this.mod).textContent = String(resData.data.length);
        }
      }
      this.currentItem = null;
      this.renderList();
      this.renderForm();
      this.notify('已删除');
    } catch (err) {
      this.notify('删除失败：请确认登录状态是否有效');
    }
  },

  // ======================= 管理页（站点 / 账号 / 两步验证 / 通行密钥 / 会话） =======================

  api: async function (path, options) {
    var opts = Object.assign({ method: 'GET', headers: {} }, options || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    var res = await fetch(this.getApiUrl(path), opts);
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      this.handle401();
      throw new Error('unauthorized');
    }
    if (!res.ok) {
      throw new Error((data && data.error) || ('HTTP ' + res.status));
    }
    return data;
  },

  // ---------- 友链管理 ----------
  linkStatusFilter: 'pending',

  loadLinks: async function () {
    var self = this;
    var err = document.getElementById('links-error');
    if (err) err.textContent = '';
    try {
      var out = await this.api('/api/admin/links?_t=' + Date.now());
      this.linksData = out;
      this.renderLinks();
    } catch (e) {
      if (err) err.textContent = e.message === 'unauthorized' ? '' : ('加载失败：' + e.message);
    }
  },

  renderLinks: function () {
    var data = this.linksData || {};
    var overview = data.overview || { count: {}, total: 0 };
    var counts = overview.count || {};
    var list = Array.isArray(data.items) ? data.items.slice() : [];
    var status = this.linkStatusFilter || 'pending';
    list = list.filter(function (it) { return (it.status || 'pending') === status; });
    list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    ['pending', 'approved', 'rejected'].forEach(function (k) {
      var el = document.getElementById('links-count-' + k);
      if (el) el.textContent = String(counts[k] || 0);
    });
    var tabs = document.querySelectorAll('#links-tabs .links-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-status') === status);
    }
    var summary = document.getElementById('links-summary');
    if (summary) summary.textContent = '共 ' + (overview.total || list.length) + ' 个站点';

    var badge = document.getElementById('count-links');
    if (badge) {
      var pending = counts.pending || 0;
      badge.textContent = pending > 0 ? ('待审 ' + pending) : String(overview.total || '');
      badge.style.color = pending > 0 ? 'var(--status-warn)' : 'var(--text-muted)';
    }

    var host = document.getElementById('admin-link-list');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<li class="admin-link-empty">' + (status === 'pending' ? '没有待审核的申请' : status === 'approved' ? '还没有通过的友链' : '没有驳回记录') + '</li>';
      return;
    }

    host.innerHTML = list.map(function (it) {
      var icon = it.icon
        ? '<img class="admin-link-icon" src="' + escAttr(it.icon) + '" alt="" onerror="this.style.visibility=\'hidden\'" />'
        : '<span class="admin-link-icon admin-link-initial">' + escapeHtml(it.initial || (it.name || '?').charAt(0)) + '</span>';
      var actions = '';
      if (status === 'pending') {
        actions = '<button class="btn btn-primary" type="button" onclick="cms.reviewLink(\'' + it.id + '\',\'approve\')">通过</button>'
          + '<button class="btn" type="button" onclick="cms.reviewLink(\'' + it.id + '\',\'reject\')">驳回</button>';
      } else if (status === 'approved') {
        actions = '<button class="btn" type="button" onclick="cms.reviewLink(\'' + it.id + '\',\'reject\')">下架</button>';
      } else {
        actions = '<button class="btn btn-primary" type="button" onclick="cms.reviewLink(\'' + it.id + '\',\'approve\')">通过</button>';
      }
      actions += '<button class="btn" type="button" onclick="cms.editLink(\'' + it.id + '\')">编辑</button>'
        + '<button class="btn btn-danger" type="button" onclick="cms.deleteLink(\'' + it.id + '\')">删除</button>';

      return '<li class="admin-link-row" data-link-id="' + it.id + '">'
        + icon
        + '<div class="admin-link-main">'
        +   '<div class="admin-link-title"><a href="' + escAttr(it.url) + '" target="_blank" rel="noopener">' + escapeHtml(it.name) + '</a>'
        +   '<span class="admin-link-status" data-status="' + (it.status || 'pending') + '">' + ({ pending: '待审核', approved: '已通过', rejected: '已驳回' }[it.status] || it.status) + '</span></div>'
        +   '<div class="admin-link-meta">' + escapeHtml(it.url) + (it.note ? ' · ' + escapeHtml(it.note) : '') + '</div>'
        +   (it.rejectReason ? '<div class="admin-link-meta admin-link-meta--dim">未通过原因：' + escapeHtml(it.rejectReason) + '</div>' : '')
        +   '<div class="admin-link-meta admin-link-meta--dim">' + escAttr(it.ip || '') + ' · ' + cms.fmtWhen(it.createdAt) + (it.email ? ' · ' + escapeHtml(it.email) : '') + '</div>'
        + '</div>'
        + '<div class="admin-link-actions">' + actions + '</div>'
        + '</li>';
    }).join('');
  },

  reviewLink: async function (id, action) {
    var err = document.getElementById('links-error');
    if (err) err.textContent = '';
    var body = { id: id };
    if (action === 'reject') {
      var reason = window.prompt('未通过的原因（会写进邮件发给申请人）：', '');
      if (reason === null) return;
      if (!String(reason).trim()) { if (err) err.textContent = '请填写未通过的原因，申请人会在邮件里看到'; return; }
      body.rejectReason = reason;
    }
    try {
      var out = await this.api('/api/admin/links/' + action, { method: 'POST', body: body });
      this.linksData = { items: out.items, overview: out.overview };
      this.renderLinks();
      this.notify(action === 'approve' ? '已通过，前台立即出现' : '已驳回');
    } catch (e) {
      if (err) err.textContent = e.message === 'unauthorized' ? '' : ('操作失败：' + e.message);
    }
  },

  editLink: function (id) {
    var list = (this.linksData && this.linksData.items) || [];
    var item = null;
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) item = list[i];
    if (!item) return;
    var name = prompt('网站名', item.name || '');
    if (name === null) return;
    var url = prompt('网站地址', item.url || '');
    if (url === null) return;
    var icon = prompt('图标地址（留空用首字）', item.icon || '');
    if (icon === null) return;
    var note = prompt('一句话介绍（可留空）', item.note || '');
    if (note === null) return;
    var email = prompt('申请人邮箱（可留空，用于接收审核结果）', item.email || '');
    if (email === null) return;
    var self = this;
    this.api('/api/admin/links/update', { method: 'POST', body: { id: id, patch: { name: name, url: url, icon: icon, note: note, email: email } } })
      .then(function (out) {
        self.linksData = { items: out.items, overview: out.overview };
        self.renderLinks();
        self.notify('已更新');
      })
      .catch(function (e) {
        var err = document.getElementById('links-error');
        if (err) err.textContent = '保存失败：' + e.message;
      });
  },

  deleteLink: async function (id) {
    if (!confirm('删除这条友链？删除后无法恢复。')) return;
    try {
      var out = await this.api('/api/admin/links/delete', { method: 'POST', body: { id: id } });
      this.linksData = { items: out.items, overview: out.overview };
      this.renderLinks();
      this.notify('已删除');
    } catch (e) {
      var err = document.getElementById('links-error');
      if (err) err.textContent = '删除失败：' + e.message;
    }
  },

  // ---------- 推送设置 ----------
  notifyData: null,
  tplCurrent: 'comment_reply',

  loadNotify: async function () {
    var self = this;
    try {
      var out = await this.api('/api/admin/notify?_t=' + Date.now());
      this.notifyData = out.config || {};
      this.renderNotify();
    } catch (e) {
      var err = document.getElementById('mail-error');
      if (err) err.textContent = e.message === 'unauthorized' ? '' : ('加载失败：' + e.message);
    }
  },

  renderNotify: function () {
    var cfg = this.notifyData || {};
    var mail = cfg.mail || {};
    var bark = cfg.bark || {};
    var channels = cfg.channels || { adminMail: true, adminBark: true };

    var set = function (id, value) { var el = document.getElementById(id); if (el) el.value = value; };
    var check = function (id, on) { var el = document.getElementById(id); if (el) el.checked = !!on; };

    check('channel-admin-mail', channels.adminMail !== false);
    check('channel-admin-bark', channels.adminBark !== false);
    check('mail-enabled', mail.enabled);
    set('mail-host', mail.host || '');
    set('mail-port', mail.port || 465);
    set('mail-user', mail.user || '');
    set('mail-pass', '');
    set('mail-from', mail.from || '');
    set('mail-from-name', mail.fromName || '');
    check('mail-secure', mail.secure);
    if (document.getElementById('mail-pass')) {
      document.getElementById('mail-pass').placeholder = mail.hasPass ? ('已保存 ' + mail.passMasked + '（留空不修改）') : '留空表示不修改';
    }
    var mailBadge = document.getElementById('mail-badge');
    if (mailBadge) {
      var mailOn = mail.enabled && mail.host;
      mailBadge.textContent = mail.enabled ? (mail.host ? '已启用' : '待补全') : '未启用';
      mailBadge.setAttribute('data-on', mailOn ? 'true' : 'false');
    }

    check('bark-enabled', bark.enabled);
    set('bark-server', bark.server || 'https://api.day.app');
    set('bark-key', bark.key || '');
    set('bark-group', bark.group || '');
    var barkBadge = document.getElementById('bark-badge');
    if (barkBadge) {
      barkBadge.textContent = bark.enabled ? (bark.key ? '已启用' : '待补全') : '未启用';
      barkBadge.setAttribute('data-on', bark.enabled && bark.key ? 'true' : 'false');
    }

    this.renderTemplate();
  },

  renderTemplate: function () {
    var cfg = this.notifyData || {};
    var tpl = (cfg.templates || {})[this.tplCurrent] || {};
    var isBark = this.tplCurrent.indexOf('bark_') === 0;
    var subjectField = document.getElementById('tpl-subject-field');
    var titleField = document.getElementById('tpl-title-field');
    if (subjectField) subjectField.hidden = isBark;
    if (titleField) titleField.hidden = !isBark;
    if (document.getElementById('tpl-subject')) document.getElementById('tpl-subject').value = tpl.subject || '';
    if (document.getElementById('tpl-title')) document.getElementById('tpl-title').value = tpl.title || '';
    if (document.getElementById('tpl-text')) document.getElementById('tpl-text').value = tpl.text || '';
    var tabs = document.querySelectorAll('.tpl-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tpl') === this.tplCurrent);
    }
  },

  saveNotifyConfig: async function (patch, okText) {
    var out = await this.api('/api/admin/notify', { method: 'POST', body: patch });
    this.notifyData = out.config || this.notifyData;
    this.renderNotify();
    if (okText) this.notify(okText);
  },

  loadSettings: async function () {
    var pkeys = [];
    try {
      var data = await this.api('/api/admin/overview?_t=' + Date.now());
      var site = data.site || {};
      document.getElementById('site-name').value = site.name || '';
      document.getElementById('site-avatar').value = site.avatarText || '';
      setSidebarAvatar(site.avatarText || site.name || '');
      document.getElementById('site-title').value = site.title || '';
      document.getElementById('site-subtitle').value = site.subtitle || '';
      if (document.getElementById('site-admin-path')) {
        document.getElementById('site-admin-path').value = site.adminPath || 'admin';
      }
      this.applyModuleConfig(site.modules, site.order);
      this.renderModules();
      this.renderFooterSettings(site.footer);
      this.renderSocials(site.socials);
      this.renderProbeSettings(site.probe);

      document.getElementById('account-username').value = data.username || '';

      var totpOn = Boolean(data.totp && data.totp.enabled);
      this.renderTotpState(totpOn);

      pkeys = data.passkeys || [];
      this.renderPasskeys(pkeys);

      this.renderSessions(data.sessions || [], data.history || [], data.blocked || []);
      this.loadIndexNow();
      this.loadTelegram();
    } catch (e) {
      if (String(e && e.message) === 'unauthorized') return;
      this.notify('管理信息加载失败：' + (e && e.message ? e.message : '未知错误'));
    }
  },

  // ---------------- 前台栏目：开关 / 改名 / 换图标 ----------------
  normalizeModules: function (raw) {
    var out = {};
    MODULE_ORDER.forEach(function (key) {
      var def = MODULE_FALLBACK[key];
      var item = (raw && raw[key]) || {};
      out[key] = {
        enabled: item.enabled === undefined ? true : !!item.enabled,
        name: String(item.name || def.name).slice(0, 12),
        icon: String(item.icon || def.icon),
        route: String(item.route || def.route || key)
      };
    });
    return out;
  },

  // 侧边栏的文字与开关状态跟随配置
  applyModuleConfig: function (modules, order) {
    var self = this;
    this.modules = this.normalizeModules(modules);
    this.order = normalizeModuleOrder(order || this.order);
    this.reorderNav();
    this.order.forEach(function (key) {
      var m = self.modules[key];
      var label = document.querySelector('.nav-label[data-label="' + key + '"]');
      if (label) label.textContent = m.name;
      var row = document.querySelector('.nav-item-row[data-nav-row="' + key + '"]');
      if (row) {
        row.setAttribute('data-disabled', m.enabled ? 'false' : 'true');
        row.style.display = m.enabled ? '' : 'none';
      }
    });
    // 当前正在编辑的栏目被关闭时，退回到「文章」，避免停在已被隐藏的页面
    if (this.mod && MODULE_ORDER.indexOf(this.mod) !== -1 && this.modules[this.mod] && !this.modules[this.mod].enabled) {
      this.switchMod('posts');
    }
  },

  // 后台侧边栏按栏目顺序重排（评论审核 / 管理固定在末尾）
  reorderNav: function () {
    var ul = document.getElementById('mod-nav');
    if (!ul) return;
    var self = this;
    var rows = {};
    var fixed = [];
    Array.prototype.slice.call(ul.children).forEach(function (li) {
      var key = li.getAttribute('data-nav-row');
      if (key === 'probe-config') key = 'probe';   // 探针页在后台叫 probe-config，顺序跟随前台 probe
      if (key && self.order.indexOf(key) !== -1) rows[key] = li;
      else fixed.push(li);
    });
    var seq = [];
    this.order.forEach(function (key) { if (rows[key]) seq.push(rows[key]); });
    fixed.forEach(function (li) { seq.push(li); });
    seq.forEach(function (li) { ul.appendChild(li); });
  },

  saveModules: async function (patch, okText, order) {
    var err = document.getElementById('module-error');
    if (err) err.textContent = '';
    try {
      var body = { modules: patch };
      if (order) body.order = order;
      var out = await this.api('/api/admin/site', { method: 'POST', body: body });
      var saved = out && out.site && out.site.modules ? out.site.modules : this.modules;
      var savedOrder = out && out.site && out.site.order ? out.site.order : this.order;
      this.applyModuleConfig(saved, savedOrder);
      this.renderModules();
      if (okText) this.notify(okText);
      return true;
    } catch (e) {
      if (err && e.message !== 'unauthorized') err.textContent = '保存失败：' + e.message;
      this.loadSettings();
      return false;
    }
  },

  toggleModule: async function (key) {
    if (!this.modules || !this.modules[key]) return;
    if (key === 'home') { this.notify('首页不能关闭'); return; }
    var m = this.modules[key];
    var patch = {};
    patch[key] = { enabled: !m.enabled };
    this.applyModuleConfig(Object.assign({}, this.modules, (function () { var o = {}; o[key] = Object.assign({}, m, patch[key]); return o; })()));
    this.renderModules();
    var ok = await this.saveModules(patch, '「' + m.name + '」已' + (!m.enabled ? '在前台显示' : '从前台隐藏'));
    if (!ok) this.applyModuleConfig(this.modules);
  },

  onModuleNameChange: async function (key, value) {
    if (!this.modules || !this.modules[key]) return;
    var name = String(value || '').trim().slice(0, 12);
    var input = document.querySelector('.module-name-input[data-name-for="' + key + '"]');
    if (!name) {
      if (input) input.value = this.modules[key].name;
      return;
    }
    if (name === this.modules[key].name) return;
    var patch = {};
    patch[key] = { name: name };
    var next = Object.assign({}, this.modules);
    next[key] = Object.assign({}, this.modules[key], { name: name });
    this.applyModuleConfig(next);
    this.renderModules();
    await this.saveModules(patch, '「' + name + '」名称已更新');
  },

  onModuleRouteChange: async function (key, value) {
    if (!this.modules || !this.modules[key] || key === 'home') return;
    var input = document.querySelector('.module-route-input[data-route-for="' + key + '"]');
    var raw = String(value || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!raw) {
      if (input) input.value = this.modules[key].route || key;
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(raw)) {
      this.notify('路径只能用字母、数字和短横线，且不能以短横线开头');
      if (input) input.value = this.modules[key].route || key;
      return;
    }
    var taken = MODULE_ORDER.some(function (k) { return k !== key && (this.modules[k].route || k) === raw; }, this);
    if (taken) {
      this.notify('路径 /' + raw + ' 已被其它栏目占用');
      if (input) input.value = this.modules[key].route || key;
      return;
    }
    if (raw === (this.modules[key].route || key)) return;
    var patch = {};
    patch[key] = { route: raw };
    var next = Object.assign({}, this.modules);
    next[key] = Object.assign({}, this.modules[key], { route: raw });
    this.modules = next;
    this.renderModules();
    await this.saveModules(patch, '「' + this.modules[key].name + '」的访问路径已改为 /' + raw);
  },

  renderModules: function () {
    var list = document.getElementById('module-list');
    if (!list || !this.modules) return;
    var self = this;
    list.innerHTML = this.order.map(function (key, index) {
      var m = self.modules[key];
      var fallback = MODULE_FALLBACK[key];
      var fixed = key === 'home';
      var route = String(m.route || key || '');
      var fixed = key === 'home';
      return '<li class="module-row" data-module="' + key + '" draggable="true" data-index="' + index + '" data-disabled="' + (m.enabled ? 'false' : 'true') + '"' +
          ' ondragstart="cms.onModuleDragStart(event, \'' + key + '\')" ondragover="cms.onModuleDragOver(event)"' +
          ' ondrop="cms.onModuleDrop(event, \'' + key + '\')" ondragend="cms.onModuleDragEnd()">' +
          '<span class="module-grip" aria-hidden="true" title="拖动调整顺序">⋮⋮</span>' +
          '<button class="module-icon-btn" type="button" data-icon-for="' + key + '" title="更换图标">' + moduleIconHtml(m.icon, fallback.icon) + '</button>' +
          '<div class="module-main">' +
            '<input class="module-name-input" data-name-for="' + key + '" maxlength="12" value="' + escAttr(m.name) + '" aria-label="栏目名称" />' +
            '<div class="module-route-row">' +
              '<span class="module-route-prefix">' + (fixed ? '/' : '/') + '</span>' +
              '<input class="module-route-input" data-route-for="' + key + '" maxlength="24" spellcheck="false"' +
                (fixed ? ' disabled title="首页固定为根路径"' : ' title="前台访问路径，例如 diary"') +
                ' value="' + escAttr(fixed ? '' : route) + '" placeholder="' + escAttr(key) + '" aria-label="访问路径" />' +
            '</div>' +
          '</div>' +
          '<span class="module-meta">' + (fixed ? '首页固定' : (m.enabled ? '显示中' : '已隐藏')) + '</span>' +
          '<button class="nav-switch" type="button" role="switch" aria-checked="' + (m.enabled ? 'true' : 'false') + '" data-switch="' + key + '"' +
            (fixed ? ' disabled title="首页不能关闭"' : ' title="在前台显示 / 隐藏「' + escAttr(m.name) + '」"') +
          '><span class="nav-switch-knob"></span></button>' +
        '</li>';
    }).join('');

    list.querySelectorAll('[data-switch]').forEach(function (btn) {
      btn.addEventListener('click', function () { self.toggleModule(btn.getAttribute('data-switch')); });
    });
    list.querySelectorAll('[data-icon-for]').forEach(function (btn) {
      btn.addEventListener('click', function () { self.openIconPicker(btn.getAttribute('data-icon-for')); });
    });
    list.querySelectorAll('[data-name-for]').forEach(function (input) {
      var key = input.getAttribute('data-name-for');
      input.addEventListener('change', function () { self.onModuleNameChange(key, input.value); });
      input.addEventListener('keydown', function (evt) { if (evt.key === 'Enter') { evt.preventDefault(); input.blur(); } });
    });
    list.querySelectorAll('[data-route-for]').forEach(function (input) {
      var key = input.getAttribute('data-route-for');
      input.addEventListener('change', function () { self.onModuleRouteChange(key, input.value); });
      input.addEventListener('keydown', function (evt) { if (evt.key === 'Enter') { evt.preventDefault(); input.blur(); } });
    });
  },

  onModuleDragStart: function (ev, key) {
    this.dragKey = key;
    try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', key); } catch (e) {}
    var row = ev.currentTarget;
    if (row && row.classList) row.classList.add('dragging');
  },

  onModuleDragOver: function (ev) {
    if (!this.dragKey) return;
    ev.preventDefault();
    try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
    var row = ev.currentTarget;
    var rows = document.querySelectorAll('#module-list .module-row');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('drag-over');
    if (row && row.classList) row.classList.add('drag-over');
  },

  onModuleDrop: async function (ev, key) {
    ev.preventDefault();
    var from = this.dragKey;
    this.dragKey = '';
    document.querySelectorAll('#module-list .module-row').forEach(function (row) {
      row.classList.remove('drag-over', 'dragging');
    });
    if (!from || from === key) return;
    var order = this.order.slice();
    var i = order.indexOf(from);
    var j = order.indexOf(key);
    if (i < 0 || j < 0) return;
    order.splice(i, 1);
    order.splice(j, 0, from);
    this.order = order;
    this.renderModules();
    this.reorderNav();
    await this.saveModules({}, '栏目顺序已更新', order);
  },

  onModuleDragEnd: function () {
    this.dragKey = '';
    document.querySelectorAll('#module-list .module-row').forEach(function (row) {
      row.classList.remove('drag-over', 'dragging');
    });
  },

  openIconPicker: function (key) {
    if (!this.modules || !this.modules[key]) return;
    this.iconTarget = key;
    var nameEl = document.getElementById('icon-modal-target');
    if (nameEl) nameEl.textContent = this.modules[key].name;
    var hint = document.getElementById('icon-upload-hint');
    if (hint) hint.textContent = '';
    var err = document.getElementById('icon-error');
    if (err) err.textContent = '';
    this.renderIconGrid();
    var modal = document.getElementById('icon-modal');
    if (modal) modal.style.display = '';
  },

  closeIconPicker: function () {
    var modal = document.getElementById('icon-modal');
    if (modal) modal.style.display = 'none';
    this.iconTarget = null;
  },

  renderIconGrid: function () {
    var grid = document.getElementById('icon-preset-grid');
    if (!grid) return;
    var self = this;
    var current = this.iconTarget && this.modules[this.iconTarget] ? this.modules[this.iconTarget].icon : '';
    grid.innerHTML = MODULE_ICON_ORDER.map(function (id) {
      return '<button class="icon-picker-item" type="button" data-icon="' + id + '" aria-pressed="' + (current === id ? 'true' : 'false') + '" title="' + id + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + MODULE_ICON_SVGS[id] + '</svg>' +
        '</button>';
    }).join('');
    grid.querySelectorAll('[data-icon]').forEach(function (btn) {
      btn.addEventListener('click', function () { self.chooseIconPreset(btn.getAttribute('data-icon')); });
    });
  },

  chooseIconPreset: async function (id) {
    if (!this.iconTarget) return;
    var key = this.iconTarget;
    var icon = id || MODULE_FALLBACK[key].icon;
    var patch = {};
    patch[key] = { icon: icon };
    var next = Object.assign({}, this.modules);
    next[key] = Object.assign({}, this.modules[key], { icon: icon });
    this.applyModuleConfig(next);
    this.renderModules();
    if (id) this.closeIconPicker();
    await this.saveModules(patch, id ? '图标已更新' : '已恢复默认图标');
  },

  uploadModuleIcon: async function (file) {
    if (!this.iconTarget || !file) return;
    var key = this.iconTarget;
    var hint = document.getElementById('icon-upload-hint');
    var err = document.getElementById('icon-error');
    if (err) err.textContent = '';
    if (hint) hint.textContent = '上传中…';
    try {
      var base64 = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '').split(',')[1] || ''); };
        reader.onerror = function () { reject(new Error('读取文件失败')); };
        reader.readAsDataURL(file);
      });
      var out = await this.api('/api/upload', { method: 'POST', body: { kind: 'image', filename: file.name, data: base64 } });
      var icon = out.relativeUrl || out.url || '';
      if (!icon) throw new Error('上传结果异常');
      var patch = {};
      patch[key] = { icon: icon };
      var next = Object.assign({}, this.modules);
      next[key] = Object.assign({}, this.modules[key], { icon: icon });
      this.applyModuleConfig(next);
      this.renderModules();
      this.closeIconPicker();
      await this.saveModules(patch, '图标已上传并保存');
    } catch (e) {
      if (hint) hint.textContent = '';
      if (err && e.message !== 'unauthorized') err.textContent = '上传失败：' + e.message;
    }
  },

  // ---------------- 探针数据源 ----------------
  // ---------------- 页脚与备案 ----------------
  FOOTER_ICONS: {
    icp: '<svg viewBox="0 0 1024 1024" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M511.36 1018.24c190.08-75.52 316.8-183.68 380.16-316.8 81.92-158.72 101.12-341.76 63.36-557.44L511.36 5.12 68.48 150.4c-37.76 209.28-19.2 392.32 56.96 551.04 69.12 133.76 196.48 241.28 385.92 316.8z m-329.6-341.76C112 537.6 93.44 378.88 124.8 194.56l385.92-126.08 385.92 126.08c24.96 183.68 6.4 341.76-63.36 475.52-56.96 113.92-165.12 202.88-323.2 272.64-163.2-63.36-271.36-158.72-328.32-266.24z"/><path d="M252.16 632.96V350.72h53.12v282.24h-53.12zM524.8 528.64l51.2 17.28c-7.68 30.72-21.12 53.12-39.04 69.12-18.56 14.72-41.6 22.4-70.4 22.4-35.2 0-64-12.8-86.4-38.4-22.4-24.96-33.92-60.16-33.92-105.6 0-47.36 11.52-83.84 33.92-109.44 22.4-26.24 52.48-39.04 88.96-39.04 32 0 58.24 10.24 78.72 30.72 12.16 12.16 21.12 29.44 26.88 51.84l-52.48 13.44c-2.56-14.72-9.6-26.24-19.84-34.56-9.6-8.32-21.76-12.8-35.84-12.8-19.84 0-35.2 7.68-48 22.4-12.16 14.72-18.56 39.04-18.56 72.96 0 35.84 6.4 60.8 18.56 76.8 12.16 15.36 27.52 22.4 46.08 22.4 14.08 0 26.24-5.12 36.48-14.72 11.52-8.32 19.2-23.68 23.68-44.8z m96.64 104.32V350.72h85.12c32 0 53.12 1.28 63.36 4.48 14.72 4.48 27.52 13.44 37.76 27.52 9.6 14.08 15.36 32 15.36 55.04 0 17.28-2.56 31.36-8.96 43.52-5.76 12.16-13.44 21.12-22.4 28.16-8.96 7.04-18.56 11.52-27.52 13.44-12.8 2.56-30.72 4.48-55.68 4.48h-33.92v106.88l-53.12-1.28z m53.76-234.88v80h28.8c21.12 0 35.2-1.28 42.24-4.48 7.04-2.56 12.8-7.68 16.64-14.08 4.48-6.4 6.4-13.44 6.4-21.76 0-10.24-2.56-19.2-8.32-24.96-5.76-7.04-12.8-10.24-21.12-12.8-6.4-1.28-19.2-1.92-37.76-1.92h-26.88z"/></svg>',
    police: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4.5 5.4v6.6c0 5.4 7.5 9 7.5 9s7.5-3.6 7.5-9V5.4L12 2z"/><path d="m12 7.4 1.35 2.74 3.02.44-2.18 2.13.51 3.01L12 14.32l-2.7 1.4.51-3.01-2.18-2.13 3.02-.44L12 7.4z"/></svg>',
    moe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/></svg>'
  },

  footerBadgeList: function () {
    var icp = (document.getElementById('footer-icp').value || '').trim();
    var police = (document.getElementById('footer-police').value || '').trim();
    var moe = (document.getElementById('footer-moe').value || '').trim();
    var digits = function (t) { return String(t || '').replace(/[^0-9]/g, ''); };
    var list = [];
    if (icp) list.push({ kind: 'icp', text: icp, href: 'https://beian.miit.gov.cn/' });
    if (police) list.push({ kind: 'police', text: police, href: 'https://beian.mps.gov.cn/#/query/webSearch?code=' + encodeURIComponent(digits(police)) });
    if (moe) list.push({ kind: 'moe', text: moe, href: 'https://icp.gov.moe/?keyword=' + encodeURIComponent(digits(moe)) });
    return list;
  },

  renderFooterPreview: function () { /* 前台效果预览已移除 */ },

  renderFooterSettings: function (footer) {
    var f = footer || {};
    var copyEl = document.getElementById('footer-copyright');
    if (copyEl) copyEl.checked = f.copyright !== false;
    document.getElementById('footer-icp').value = f.icpText || '';
    document.getElementById('footer-police').value = f.policeText || '';
    document.getElementById('footer-moe').value = f.moeText || '';
    document.getElementById('footer-extra').value = f.extra || '';
    this.renderFooterPreview();
  },

  saveFooter: function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var err = document.getElementById('footer-error');
    err.textContent = '';
    this.api('/api/admin/site', {
      method: 'POST',
      body: {
        footer: {
          icpText: document.getElementById('footer-icp').value.trim(),
          policeText: document.getElementById('footer-police').value.trim(),
          moeText: document.getElementById('footer-moe').value.trim(),
          extra: document.getElementById('footer-extra').value.trim(),
          copyright: !!document.getElementById('footer-copyright').checked
        }
      }
    }).then(function (res) {
      cms.renderFooterSettings(res.site && res.site.footer);
      cms.notify('页脚已保存');
    }).catch(function (e) {
      err.textContent = e.message || '保存失败';
    });
  },

  // ---------------- IndexNow 推送 ----------------
  loadIndexNow: function () {
    var self = this;
    return this.api('/api/admin/indexnow').then(function (res) {
      self.renderIndexNow(res.config);
    }).catch(function () { /* 忽略：不影响其它设置 */ });
  },

  renderIndexNow: function (cfg) {
    var c = cfg || {};
    var keyEl = document.getElementById('indexnow-key');
    var locEl = document.getElementById('indexnow-location');
    if (keyEl) keyEl.value = c.key || '';
    if (locEl) locEl.value = c.rawKeyLocation || '';
    var badge = document.getElementById('indexnow-badge');
    if (badge) {
      badge.textContent = c.valid ? '已启用' : '未启用';
      badge.setAttribute('data-on', c.valid ? 'true' : 'false');
    }
    var nameEl = document.getElementById('indexnow-filename');
    if (nameEl) nameEl.textContent = (c.key || '密钥') + '.txt';
    var statusEl = document.getElementById('indexnow-status');
    if (statusEl) {
      statusEl.textContent = c.valid
        ? '已生效，密钥文件地址：' + c.keyLocation
        : '填写密钥并保存后才会开始推送';
    }
  },

  saveIndexNow: function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var err = document.getElementById('indexnow-error');
    var statusEl = document.getElementById('indexnow-status');
    if (err) err.textContent = '';
    this.api('/api/admin/indexnow', {
      method: 'POST',
      body: {
        key: document.getElementById('indexnow-key').value.trim(),
        keyLocation: document.getElementById('indexnow-location').value.trim()
      }
    }).then(function (res) {
      cms.renderIndexNow(res.config);
      cms.notify(res.config && res.config.valid ? 'IndexNow 已启用' : 'IndexNow 已关闭');
      if (statusEl && res.config && res.config.valid) statusEl.textContent = '已保存，密钥文件地址：' + res.config.keyLocation;
    }).catch(function (e) {
      if (err) err.textContent = e.message || '保存失败';
    });
  },

  verifyIndexNowKey: function () {
    var btn = document.getElementById('indexnow-verify-btn');
    var statusEl = document.getElementById('indexnow-status');
    var err = document.getElementById('indexnow-error');
    if (err) err.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = '检查中…'; }
    this.api('/api/admin/indexnow/verify', { method: 'POST', body: {} })
      .then(function (res) {
        if (statusEl) statusEl.textContent = '✅ 密钥文件可访问：' + res.keyLocation;
        cms.notify('密钥文件检查通过');
      })
      .catch(function (e) {
        var msg = (e && e.message) || '检查失败';
        if (err) err.textContent = msg;
        if (statusEl) statusEl.textContent = '❌ ' + msg;
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = '检查密钥文件'; }
      });
  },

  openTelegramSettings: function () {
    this.openSettings({});
    var self = this;
    setTimeout(function () { self.jumpToCard('card-telegram'); }, 260);
  },

  loadTelegram: function () {
    var self = this;
    return this.api('/api/admin/telegram').then(function (res) {
      self.renderTelegram(res.config, res.synced);
    }).catch(function () { /* 忽略：不影响其它设置 */ });
  },

  renderTelegram: function (cfg, synced) {
    var c = cfg || {};
    var enabled = document.getElementById('telegram-enabled');
    var chat = document.getElementById('telegram-chat');
    var site = document.getElementById('telegram-site');
    var silent = document.getElementById('telegram-silent');
    var token = document.getElementById('telegram-token');
    var badge = document.getElementById('telegram-badge');
    var status = document.getElementById('telegram-status');
    if (enabled) enabled.checked = !!c.enabled;
    if (chat) chat.value = c.chatId || '';
    if (site) site.value = c.siteUrl || '';
    if (silent) silent.checked = !!c.silent;
    if (token) {
      token.value = '';
      token.placeholder = c.hasToken ? ('已保存 ' + c.botTokenMasked + '（留空不修改）') : '123456789:AA…';
    }
    var ready = !!(c.enabled && c.hasToken && c.chatId);
    if (badge) {
      badge.textContent = ready ? '已启用' : (c.enabled ? '待补全' : '未启用');
      badge.setAttribute('data-on', ready ? 'true' : 'false');
    }
    if (status) {
      if (!c.enabled) status.textContent = '开关关闭时不会同步任何碎碎念。';
      else if (!c.hasToken) status.textContent = '还差 Bot Token，填好并保存后开始同步。';
      else if (!c.chatId) status.textContent = '还差频道 / 会话 ID。';
      else status.textContent = '已同步 ' + (synced || 0) + ' 条碎碎念；新建、编辑会重发，删除会撤回。';
    }
  },

  saveTelegram: function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var err = document.getElementById('telegram-error');
    var status = document.getElementById('telegram-status');
    if (err) err.textContent = '';
    var payload = {
      enabled: document.getElementById('telegram-enabled').checked,
      chatId: document.getElementById('telegram-chat').value.trim(),
      siteUrl: document.getElementById('telegram-site').value.trim(),
      silent: document.getElementById('telegram-silent').checked
    };
    var tokenVal = document.getElementById('telegram-token').value.trim();
    if (tokenVal) payload.botToken = tokenVal;
    this.api('/api/admin/telegram', { method: 'POST', body: payload }).then(function (res) {
      cms.renderTelegram(res.config, res.synced);
      cms.notify('碎碎念同步设置已保存');
      if (status) status.textContent = '已保存。' + (res.config && res.config.enabled ? '可以点「发送测试消息」验证。' : '');
    }).catch(function (e) {
      if (err) err.textContent = e.message || '保存失败';
    });
  },

  testTelegram: function () {
    var btn = document.getElementById('telegram-test-btn');
    var err = document.getElementById('telegram-error');
    var status = document.getElementById('telegram-status');
    if (err) err.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }
    this.api('/api/admin/telegram/test', { method: 'POST', body: {} })
      .then(function (res) {
        if (status) status.textContent = '✅ 已发送测试消息' + (res.botUsername ? '（' + res.botUsername + '）' : '') + '，请到频道查看。';
        cms.notify('测试消息已发送');
      })
      .catch(function (e) {
        var msg = (e && e.message) || '发送失败';
        if (err) err.textContent = msg;
        if (status) status.textContent = '❌ ' + msg;
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = '发送测试消息'; }
      });
  },

  downloadIndexNowKey: function () {
    var el = document.getElementById('indexnow-key');
    var key = el ? el.value.trim() : '';
    if (!key) {
      document.getElementById('indexnow-status').textContent = '请先填写并保存密钥';
      return;
    }
    var blob = new Blob([key], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = key + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    document.getElementById('indexnow-status').textContent = '已下载 ' + key + '.txt，请放到前端根目录一起部署';
  },

  // ---------------- 社交链接 ----------------
  renderSocials: function (socials) {
    var s = socials || {};
    document.getElementById('social-github').value = s.github || '';
    document.getElementById('social-x').value = s.x || '';
    document.getElementById('social-telegram').value = s.telegram || '';
    var email = String(s.email || '');
    document.getElementById('social-email').value = email.indexOf('mailto:') === 0 ? email.slice(7) : email;
  },

  saveSocials: function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var err = document.getElementById('social-error');
    err.textContent = '';
    var email = document.getElementById('social-email').value.trim();
    if (email && email.indexOf('mailto:') !== 0) email = 'mailto:' + email;
    this.api('/api/admin/site', {
      method: 'POST',
      body: {
        socials: {
          github: document.getElementById('social-github').value.trim(),
          x: document.getElementById('social-x').value.trim(),
          telegram: document.getElementById('social-telegram').value.trim(),
          email: email
        }
      }
    }).then(function (res) {
      cms.renderSocials(res.site && res.site.socials);
      cms.notify('社交链接已保存');
    }).catch(function (e) {
      err.textContent = e.message || '保存失败';
    });
  },

  // 侧边栏「管理」二级菜单：鼠标悬停临时展开；点右侧小三角固定展开（点别处才收起）；
  // 点按钮左侧（图标与文字）仍是原来的行为——直接进入管理页，不弹菜单。
  menuPinned: false,
  suppressHoverUntil: 0,
  subnavTarget: '',
  subnavHoldUntil: 0,

  openSettings: function (ev) {
    var subnav = document.getElementById('settings-subnav');
    var btn = (ev && (ev.currentTarget || ev.target)) || null;
    if (btn && btn.closest) btn = btn.closest('.nav-btn') || btn;
    var rect = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : null;
    var onArrow = !!(ev && rect && typeof ev.clientX === 'number' && ev.clientX >= rect.right - 26);

    if (onArrow) {
      if (ev.preventDefault) ev.preventDefault();
      if (ev.stopPropagation) ev.stopPropagation();
      // 只有在「已固定展开」时第二次点箭头才收起，否则一律固定展开
      var willOpen = !(this.menuPinned && subnav && !subnav.hidden);
      this.menuPinned = willOpen;
      if (willOpen) this.showSettingsMenu();
      else this.closeSettingsMenu();
      return;
    }

    // 左侧：正常进入「管理」页，不弹出二级菜单（并短暂抑制悬停自动展开）
    this.menuPinned = false;
    this.suppressHoverUntil = Date.now() + 500;
    this.closeSettingsMenu();
    this.switchMod('settings');
  },

  showSettingsMenu: function () {
    var subnav = document.getElementById('settings-subnav');
    var row = document.querySelector('.nav-item-row[data-nav-row="settings"]');
    if (subnav) subnav.hidden = false;
    if (row) row.classList.add('menu-open');
  },

  closeSettingsMenu: function () {
    var subnav = document.getElementById('settings-subnav');
    if (subnav) subnav.hidden = true;
    var row = document.querySelector('.nav-item-row[data-nav-row="settings"]');
    if (row) row.classList.remove('menu-open');
    this.menuPinned = false;
  },

  clearSubnavActive: function () {
    var subs = document.querySelectorAll('#settings-subnav .nav-sub-btn');
    for (var i = 0; i < subs.length; i++) subs[i].classList.remove('active');
  },

  // 高亮「当前正在看的那张卡片」；不在管理页或看不到卡片时全部取消
  syncSubnavActive: function () {
    if (this.mod !== 'settings') { this.clearSubnavActive(); return; }
    var page = document.getElementById('admin-settings');
    if (!page || page.hidden) { this.clearSubnavActive(); return; }
    var cards = page.querySelectorAll('.settings-card[id]');
    if (!cards.length) { this.clearSubnavActive(); return; }

    // 刚点过的区块只要还在视野里就保持高亮（同一行左右两张卡不会互相抢）
    var target = this.subnavTarget;
    if (target) {
      var tEl = document.getElementById(target);
      var hold = Date.now() < this.subnavHoldUntil;
      if (tEl) {
        var tr = tEl.getBoundingClientRect();
        if (hold || (tr.bottom > 120 && tr.top < window.innerHeight * 0.6)) {
          this.setSubnavActive(target);
          return;
        }
      }
      this.subnavTarget = '';
    }

    // 否则取「顶部离 170px 最近且已滚过」的那张；同一行并列时取文档顺序靠前的
    var current = '';
    var bestTop = -Infinity;
    for (var i = 0; i < cards.length; i++) {
      var top = cards[i].getBoundingClientRect().top;
      if (top <= 170 && top > bestTop) { bestTop = top; current = cards[i].id; }
    }
    if (!current) current = cards[0].id;
    this.setSubnavActive(current);
  },

  setSubnavActive: function (cardId) {
    var subs = document.querySelectorAll('#settings-subnav .nav-sub-btn');
    for (var j = 0; j < subs.length; j++) {
      subs[j].classList.toggle('active', subs[j].getAttribute('data-jump') === cardId);
    }
  },

  // 侧边栏「管理」二级菜单：跳到对应卡片
  jumpToCard: function (cardId) {
    if (this.mod !== 'settings') this.switchMod('settings');
    this.closeSettingsMenu();
    var card = document.getElementById(cardId);
    if (!card) return;
    this.subnavTarget = cardId;
    this.subnavHoldUntil = Date.now() + 1400;
    this.setSubnavActive(cardId);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.remove('card-flash');
    void card.offsetWidth;
    card.classList.add('card-flash');
    setTimeout(function () { card.classList.remove('card-flash'); }, 1200);
    var self = this;
    setTimeout(function () { self.syncSubnavActive(); }, 420);
  },

  renderProbeSettings: function (probe) {
    var p = probe || {};
    var provider = document.getElementById('probe-provider');
    var url = document.getElementById('probe-url');
    var panel = document.getElementById('probe-panel');
    var enabled = document.getElementById('probe-enabled');
    if (!provider || !url || !panel || !enabled) return;
    provider.value = p.provider === 'minimal' ? 'minimal' : 'cf';
    url.value = p.url || '';
    panel.value = p.panelUrl || '';
    enabled.checked = p.enabled === undefined ? true : !!p.enabled;
    this.updateProbeHint();
  },

  updateProbeHint: function () {
    var hint = document.getElementById('probe-hint');
    var provider = document.getElementById('probe-provider');
    if (!hint || !provider) return;
    hint.textContent = provider.value === 'minimal'
      ? '极简探针：填面板首页地址（读取 /api/nodes，只显示公开节点）。'
      : 'CF 探针：填面板首页地址（读取 /api/servers）。';
  },

  saveProbe: async function () {
    var err = document.getElementById('probe-error');
    err.textContent = '';
    var payload = {
      enabled: document.getElementById('probe-enabled').checked,
      provider: document.getElementById('probe-provider').value,
      url: document.getElementById('probe-url').value.trim(),
      panelUrl: document.getElementById('probe-panel').value.trim()
    };
    if (payload.url && !/^https?:\/\/[^\s]+$/i.test(payload.url)) {
      err.textContent = '探针地址必须以 http:// 或 https:// 开头';
      return;
    }
    if (payload.panelUrl && !/^https?:\/\/[^\s]+$/i.test(payload.panelUrl)) {
      err.textContent = '监控后台地址必须以 http:// 或 https:// 开头';
      return;
    }
    try {
      var out = await this.api('/api/admin/site', { method: 'POST', body: { probe: payload } });
      this.renderProbeSettings((out.site || {}).probe || payload);
      this.notify('探针设置已保存，前台刷新后生效');
    } catch (e) {
      err.textContent = e.message === 'unauthorized' ? '' : ('保存失败：' + e.message);
    }
  },

  // 侧边栏「状态 ONLINE」悬停气泡显示前端已部署版本（来自 GET /api/deploy-version）
  loadDeployVersion: async function () {
    var badge = document.getElementById('conn-badge');
    var tip = document.getElementById('conn-tip');
    if (!badge || !tip) return;
    try {
      var data = await this.api('/api/deploy-version?_t=' + Date.now());
      if (!data || !data.version) return;
      var lines = ['部署版本 ' + data.version];
      if (data.commit) lines.push('提交 ' + String(data.commit).slice(0, 7));
      if (data.branch) lines.push('分支 ' + data.branch);
      tip.textContent = lines.join(' · ');
      tip.hidden = false;
      badge.setAttribute('data-deploy-version', data.version);
    } catch (e) {
      /* 拿不到版本不提示，避免干扰 */
    }
  },

  bindSettings: function () {
    var self = this;

    document.getElementById('site-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = document.getElementById('site-error');
      err.textContent = '';
      var payload = {
        name: document.getElementById('site-name').value.trim(),
        avatarText: document.getElementById('site-avatar').value.trim(),
        title: document.getElementById('site-title').value.trim(),
        subtitle: document.getElementById('site-subtitle').value.trim(),
        adminPath: (document.getElementById('site-admin-path') || {}).value ? document.getElementById('site-admin-path').value.trim() : ''
      };
      if (!payload.name) { err.textContent = '站点名称不能为空'; return; }
      try {
        var out = await self.api('/api/admin/site', { method: 'POST', body: payload });
        var site = out.site || payload;
        document.getElementById('site-name').value = site.name;
        document.getElementById('site-avatar').value = site.avatarText;
        setSidebarAvatar(site.avatarText || site.name);
        document.getElementById('site-title').value = site.title;
        document.getElementById('site-subtitle').value = site.subtitle;
        if (document.getElementById('site-admin-path')) {
          document.getElementById('site-admin-path').value = site.adminPath || 'admin';
        }
        self.notify(site.adminPath && site.adminPath !== 'admin'
          ? '已保存。后台新入口：/' + site.adminPath
          : '站点信息已保存，前台刷新后生效');
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('保存失败：' + e2.message);
      }
    });

    document.getElementById('username-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = document.getElementById('username-error');
      err.textContent = '';
      var username = document.getElementById('account-username').value.trim();
      var password = document.getElementById('account-password').value;
      if (!username) { err.textContent = '用户名不能为空'; return; }
      if (!password) { err.textContent = '请输入当前密码以确认身份'; return; }
      try {
        await self.api('/api/auth/change-username', { method: 'POST', body: { username: username, password: password } });
        document.getElementById('account-password').value = '';
        document.getElementById('auth-username').textContent = username;
        self.notify('管理员用户名已更新');
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('修改失败：' + e2.message);
      }
    });

    document.getElementById('totp-start-btn').addEventListener('click', async function () {
      var err = document.getElementById('totp-error');
      err.textContent = '';
      var pwd = window.prompt('启用两步验证前，请再次输入当前密码以确认身份：');
      if (!pwd) return;
      try {
        var out = await self.api('/api/auth/totp/setup', { method: 'POST', body: { currentPassword: pwd } });
        document.getElementById('totp-secret').textContent = out.secret;
        document.getElementById('totp-uri').textContent = out.otpauth;
        document.getElementById('totp-code').value = '';
        document.getElementById('totp-setup-box').hidden = false;
        document.getElementById('totp-off-box').hidden = true;
        document.getElementById('backup-codes').hidden = true;
        setTimeout(function () { document.getElementById('totp-code').focus(); }, 60);
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('生成密钥失败：' + e2.message);
      }
    });

    document.getElementById('totp-copy-btn').addEventListener('click', function () {
      var text = document.getElementById('totp-secret').textContent;
      self.copy(text, '密钥已复制');
    });
    document.getElementById('totp-uri-copy-btn').addEventListener('click', function () {
      var text = document.getElementById('totp-uri').textContent;
      self.copy(text, '链接已复制');
    });

    document.getElementById('totp-cancel-btn').addEventListener('click', function () {
      document.getElementById('totp-setup-box').hidden = true;
      document.getElementById('totp-off-box').hidden = false;
    });

    document.getElementById('totp-enable-btn').addEventListener('click', async function () {
      var err = document.getElementById('totp-error');
      err.textContent = '';
      var code = document.getElementById('totp-code').value.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) { err.textContent = '请输入 6 位验证码'; return; }
      try {
        var out = await self.api('/api/auth/totp/enable', { method: 'POST', body: { code: code } });
        self.renderTotpState(true);
        self.showBackupCodes(out.backupCodes);
        self.notify('两步验证已启用，请妥善保存备用码');
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('启用失败：' + e2.message);
      }
    });

    document.getElementById('totp-disable-btn').addEventListener('click', async function () {
      var err = document.getElementById('totp-error');
      err.textContent = '';
      var pwd = window.prompt('关闭两步验证会降低账户安全性。请输入当前密码确认：');
      if (!pwd) return;
      try {
        await self.api('/api/auth/totp/disable', { method: 'POST', body: { password: pwd } });
        self.renderTotpState(false);
        self.notify('两步验证已关闭');
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('关闭失败：' + e2.message);
      }
    });

    document.getElementById('totp-backup-btn').addEventListener('click', async function () {
      var err = document.getElementById('totp-error');
      err.textContent = '';
      var pwd = window.prompt('重新生成会使旧备用码全部失效。请输入当前密码确认：');
      if (!pwd) return;
      try {
        var out = await self.api('/api/auth/backup-codes', { method: 'POST', body: { password: pwd } });
        self.showBackupCodes(out.backupCodes);
        self.notify('备用码已重新生成');
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('生成失败：' + e2.message);
      }
    });

    document.getElementById('passkey-add-btn').addEventListener('click', function () {
      self.addPasskey();
    });

    document.getElementById('revoke-others-btn').addEventListener('click', async function () {
      var err = document.getElementById('session-error');
      err.textContent = '';
      try {
        var out = await self.api('/api/auth/sessions/revoke-others', { method: 'POST', body: {} });
        self.notify('已下线 ' + out.revoked + ' 个其它设备');
        self.loadSettings();
      } catch (e2) {
        err.textContent = e2.message === 'unauthorized' ? '' : ('操作失败：' + e2.message);
      }
    });

    var footerForm = document.getElementById('footer-form');
    if (footerForm) {
      footerForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveFooter(); });
      ['footer-icp', 'footer-police', 'footer-moe', 'footer-extra'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { self.renderFooterPreview(); });
      });
    }
    var siteNameEl = document.getElementById('site-name');
    if (siteNameEl) siteNameEl.addEventListener('input', function () { self.renderFooterPreview(); });

    var socialForm = document.getElementById('social-form');
    if (socialForm) {
      socialForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveSocials(); });
    }

    var telegramForm = document.getElementById('telegram-form');
    if (telegramForm) {
      telegramForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveTelegram(); });
      var tgTest = document.getElementById('telegram-test-btn');
      if (tgTest) tgTest.addEventListener('click', function () { self.testTelegram(); });
    }

    var indexnowForm = document.getElementById('indexnow-form');
    if (indexnowForm) {
      indexnowForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveIndexNow(); });
      var verifyBtn = document.getElementById('indexnow-verify-btn');
      if (verifyBtn) verifyBtn.addEventListener('click', function () { self.verifyIndexNowKey(); });
      var dlBtn = document.getElementById('indexnow-download-btn');
      if (dlBtn) dlBtn.addEventListener('click', function () { self.downloadIndexNowKey(); });
    }

    // 滚动时更新二级菜单高亮（只在管理页生效）
    var scrollRaf = false;
    window.addEventListener('scroll', function () {
      if (scrollRaf) return;
      scrollRaf = true;
      requestAnimationFrame(function () { scrollRaf = false; self.syncSubnavActive(); });
    }, { passive: true });

    // 侧边栏「管理」：悬停展开、移开 180ms 后收起（点右侧固定后不受影响）
    var settingsRow = document.querySelector('.nav-item-row[data-nav-row="settings"]');
    var settingsSub = document.getElementById('settings-subnav');
    var hideTimer = null;
    function cancelHide() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }
    function scheduleHide() {
      if (self.menuPinned) return;
      cancelHide();
      hideTimer = setTimeout(function () {
        hideTimer = null;
        if (!self.menuPinned) self.closeSettingsMenu();
      }, 180);
    }
    if (settingsRow) {
      settingsRow.addEventListener('mouseenter', function () {
        if (Date.now() < self.suppressHoverUntil) return;
        cancelHide();
        self.showSettingsMenu();
      });
      settingsRow.addEventListener('mouseleave', scheduleHide);
    }
    if (settingsSub) {
      settingsSub.addEventListener('mouseenter', cancelHide);
      settingsSub.addEventListener('mouseleave', scheduleHide);
    }

    // 点击「管理」以外的区域，或按 Esc，收起二级菜单
    document.addEventListener('click', function (ev) {
      var row = document.querySelector('.nav-item-row[data-nav-row="settings"]');
      if (row && !row.contains(ev.target)) self.closeSettingsMenu();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') self.closeSettingsMenu();
    });

    var subnav = document.getElementById('settings-subnav');
    if (subnav) {
      subnav.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-jump]') : null;
        if (btn) self.jumpToCard(btn.getAttribute('data-jump'));
      });
    }

    var probeForm = document.getElementById('probe-form');
    if (probeForm) {
      probeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        self.saveProbe();
      });
    }
    var probeProvider = document.getElementById('probe-provider');
    if (probeProvider) {
      probeProvider.addEventListener('change', function () { self.updateProbeHint(); });
    }

    // 栏目图标：上传按钮与遮罩关闭
    var iconInput = document.getElementById('icon-upload-input');
    if (iconInput) {
      iconInput.addEventListener('change', function () {
        var file = iconInput.files && iconInput.files[0];
        iconInput.value = '';
        if (file) self.uploadModuleIcon(file);
      });
    }
    var iconModal = document.getElementById('icon-modal');
    if (iconModal) {
      iconModal.addEventListener('click', function (evt) {
        if (evt.target === iconModal) self.closeIconPicker();
      });
    }

    // 友链：状态切换与行内操作
    var linkTabs = document.getElementById('links-tabs');
    if (linkTabs) {
      linkTabs.addEventListener('click', function (ev) {
        var tab = ev.target.closest ? ev.target.closest('.links-tab') : null;
        if (!tab) return;
        self.linkStatusFilter = tab.getAttribute('data-status') || 'pending';
        self.renderLinks();
      });
    }

    // 通知渠道（发给站长的邮件 / Bark 开关）
    var channelForm = document.getElementById('channel-form');
    if (channelForm) {
      channelForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var err = document.getElementById('channel-error');
        if (err) err.textContent = '';
        var payload = {
          channels: {
            adminMail: document.getElementById('channel-admin-mail').checked,
            adminBark: document.getElementById('channel-admin-bark').checked
          }
        };
        self.saveNotifyConfig(payload, '通知渠道已保存')
          .catch(function (e2) { if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('保存失败：' + e2.message); });
      });
    }

    // 新增友链：展开 / 上传图标 / 提交
    var addLinkBtn = document.getElementById('links-add-btn');
    var newLinkCard = document.getElementById('card-link-new');
    if (addLinkBtn && newLinkCard) {
      addLinkBtn.addEventListener('click', function () {
        newLinkCard.hidden = !newLinkCard.hidden;
        if (!newLinkCard.hidden) {
          newLinkCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          var urlEl = document.getElementById('link-new-url');
          if (urlEl) urlEl.focus();
        }
      });
    }
    var cancelLink = document.getElementById('link-new-cancel');
    if (cancelLink && newLinkCard) {
      cancelLink.addEventListener('click', function () {
        newLinkCard.hidden = true;
        var f = document.getElementById('link-new-form');
        if (f) f.reset();
      });
    }
    var linkIconFile = document.getElementById('link-new-icon-file');
    var linkIconUpload = document.getElementById('link-new-icon-upload');
    if (linkIconUpload && linkIconFile) {
      linkIconUpload.addEventListener('click', function () { linkIconFile.click(); });
      linkIconFile.addEventListener('change', async function () {
        var file = linkIconFile.files && linkIconFile.files[0];
        linkIconFile.value = '';
        if (!file) return;
        var err = document.getElementById('link-new-error');
        if (err) err.textContent = '';
        linkIconUpload.disabled = true;
        linkIconUpload.textContent = '上传中…';
        try {
          var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('读取图片失败')); };
            reader.readAsDataURL(file);
          });
          var base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
          var out = await self.api('/api/upload', { method: 'POST', body: { kind: 'image', filename: file.name || 'icon.png', data: base64 } });
          var iconEl = document.getElementById('link-new-icon');
          if (iconEl) iconEl.value = out.url || out.relativeUrl || '';
          self.notify(out.converted ? '已上传并转为 WebP' : '图标已上传');
        } catch (e2) {
          if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('上传失败：' + e2.message);
        } finally {
          linkIconUpload.disabled = false;
          linkIconUpload.textContent = '上传图片';
        }
      });
    }
    var newLinkForm = document.getElementById('link-new-form');
    if (newLinkForm) {
      newLinkForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var err = document.getElementById('link-new-error');
        if (err) err.textContent = '';
        var payload = {
          url: (document.getElementById('link-new-url') || {}).value || '',
          name: (document.getElementById('link-new-name') || {}).value || '',
          icon: (document.getElementById('link-new-icon') || {}).value || '',
          email: (document.getElementById('link-new-email') || {}).value || '',
          note: (document.getElementById('link-new-note') || {}).value || ''
        };
        try {
          var out = await self.api('/api/admin/links/create', { method: 'POST', body: payload });
          self.linkItems = out.items || [];
          self.linkOverview = out.overview || {};
          self.linkStatusFilter = 'approved';
          self.renderLinks();
          newLinkForm.reset();
          if (newLinkCard) newLinkCard.hidden = true;
          self.notify('友链已添加并上线');
        } catch (e2) {
          if (err) err.textContent = e2.message === 'unauthorized' ? '' : (e2.message || '保存失败');
        }
      });
    }

    // 邮件设置
    var mailForm = document.getElementById('mail-form');
    if (mailForm) {
      mailForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var err = document.getElementById('mail-error');
        var status = document.getElementById('mail-status');
        if (err) err.textContent = '';
        if (status) status.textContent = '';
        var payload = {
          mail: {
            enabled: document.getElementById('mail-enabled').checked,
            host: document.getElementById('mail-host').value.trim(),
            port: Number(document.getElementById('mail-port').value) || 465,
            secure: document.getElementById('mail-secure').checked,
            user: document.getElementById('mail-user').value.trim(),
            from: document.getElementById('mail-from').value.trim(),
            fromName: document.getElementById('mail-from-name').value.trim()
          }
        };
        var pass = document.getElementById('mail-pass').value;
        if (pass) payload.mail.pass = pass;
        self.saveNotifyConfig(payload, '邮件设置已保存')
          .then(function () { if (status) status.textContent = '已保存。可以点「发送测试邮件」验证。'; })
          .catch(function (e2) { if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('保存失败：' + e2.message); });
      });
    }
    var mailTest = document.getElementById('mail-test-btn');
    if (mailTest) {
      mailTest.addEventListener('click', async function () {
        var err = document.getElementById('mail-error');
        var status = document.getElementById('mail-status');
        if (err) err.textContent = '';
        if (status) status.textContent = '正在发送…';
        mailTest.disabled = true;
        try {
          var out = await self.api('/api/admin/notify/test', { method: 'POST', body: { kind: 'mail' } });
          if (status) status.textContent = out.message || '已发送';
        } catch (e2) {
          if (status) status.textContent = '';
          if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('测试失败：' + e2.message);
        } finally {
          mailTest.disabled = false;
        }
      });
    }

    // Bark 推送
    var barkForm = document.getElementById('bark-form');
    if (barkForm) {
      barkForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var err = document.getElementById('bark-error');
        var status = document.getElementById('bark-status');
        if (err) err.textContent = '';
        if (status) status.textContent = '';
        var payload = {
          bark: {
            enabled: document.getElementById('bark-enabled').checked,
            server: document.getElementById('bark-server').value.trim(),
            key: document.getElementById('bark-key').value.trim(),
            group: document.getElementById('bark-group').value.trim(),
            level: (document.getElementById('bark-level') || {}).value || 'active',
            sound: (document.getElementById('bark-sound') || {}).value ? document.getElementById('bark-sound').value.trim() : ''
          }
        };
        self.saveNotifyConfig(payload, '推送设置已保存')
          .then(function () { if (status) status.textContent = '已保存。可以点「发送测试推送」验证。'; })
          .catch(function (e2) { if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('保存失败：' + e2.message); });
      });
    }
    var barkTest = document.getElementById('bark-test-btn');
    if (barkTest) {
      barkTest.addEventListener('click', async function () {
        var err = document.getElementById('bark-error');
        var status = document.getElementById('bark-status');
        if (err) err.textContent = '';
        if (status) status.textContent = '正在推送…';
        barkTest.disabled = true;
        try {
          var out = await self.api('/api/admin/notify/test', { method: 'POST', body: { kind: 'bark' } });
          if (status) status.textContent = out.message || '已推送';
        } catch (e2) {
          if (status) status.textContent = '';
          if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('推送失败：' + e2.message);
        } finally {
          barkTest.disabled = false;
        }
      });
    }

    // 模板切换 / 保存 / 恢复默认
    var notifyPage = document.getElementById('admin-notify');
    if (notifyPage) {
      notifyPage.addEventListener('click', function (ev) {
        var tab = ev.target && ev.target.closest ? ev.target.closest('.tpl-tab') : null;
        if (!tab) return;
        self.tplCurrent = tab.getAttribute('data-tpl') || 'comment_reply';
        self.renderTemplate();
      });
    }
    var tplForm = document.getElementById('tpl-form');
    if (tplForm) {
      tplForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var err = document.getElementById('tpl-error');
        if (err) err.textContent = '';
        var isBark = self.tplCurrent.indexOf('bark_') === 0;
        var tpl = { text: document.getElementById('tpl-text').value };
        if (isBark) tpl.title = document.getElementById('tpl-title').value;
        else tpl.subject = document.getElementById('tpl-subject').value;
        var patch = { templates: {} };
        patch.templates[self.tplCurrent] = tpl;
        self.saveNotifyConfig(patch, '模板已保存')
          .catch(function (e2) { if (err) err.textContent = e2.message === 'unauthorized' ? '' : ('保存失败：' + e2.message); });
      });
    }
    var tplReset = document.getElementById('tpl-reset-btn');
    if (tplReset) {
      tplReset.addEventListener('click', async function () {
        var err = document.getElementById('tpl-error');
        if (err) err.textContent = '';
        try {
          var out = await self.api('/api/admin/notify?_t=' + Date.now());
          var defaults = (out.config && out.config.defaults) || (out.defaults || {});
          var isBark = self.tplCurrent.indexOf('bark_') === 0;
          var d = defaults[self.tplCurrent] || {};
          if (isBark) {
            document.getElementById('tpl-title').value = d.title || '';
          } else {
            document.getElementById('tpl-subject').value = d.subject || '';
          }
          document.getElementById('tpl-text').value = d.text || '';
          self.notify('已填入默认模板，点「保存模板」生效');
        } catch (e2) {
          if (err) err.textContent = '读取默认模板失败：' + e2.message;
        }
      });
    }
  },

  copy: function (text, okMsg) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        cms.notify(okMsg || '已复制');
      }).catch(function () { cms.notify('复制失败，请手动选择文本'); });
      return;
    }
    cms.notify('复制失败，请手动选择文本');
  },

  renderTotpState: function (on) {
    var badge = document.getElementById('totp-badge');
    badge.textContent = on ? '已启用' : '未启用';
    badge.setAttribute('data-on', on ? 'true' : 'false');
    document.getElementById('totp-off-box').hidden = on;
    document.getElementById('totp-on-box').hidden = !on;
    document.getElementById('totp-setup-box').hidden = true;
    if (!on) document.getElementById('backup-codes').hidden = true;
  },

  showBackupCodes: function (codes) {
    var el = document.getElementById('backup-codes');
    if (!codes || !codes.length) { el.hidden = true; return; }
    el.textContent = codes.join('\n');
    el.hidden = false;
  },

  renderPasskeys: function (list) {
    var ul = document.getElementById('passkey-list');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="empty-tip">还没有通行密钥，添加后可用指纹 / 面容免密码登录。</li>';
      return;
    }
    list.forEach(function (pk) {
      var li = document.createElement('li');
      li.className = 'passkey-item';
      var when = pk.createdAt ? new Date(pk.createdAt).toLocaleDateString('zh-CN') : '—';
      var used = pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleString('zh-CN') : '未使用';
      li.innerHTML = '<div class="pk-main"><div class="pk-name">' + cms.escape(pk.label || '通行密钥') +
        '</div><div class="pk-meta">添加于 ' + cms.escape(when) + ' · 最近使用 ' + cms.escape(used) + '</div></div>';
      var btn = document.createElement('button');
      btn.className = 'btn btn-danger';
      btn.type = 'button';
      btn.textContent = '删除';
      btn.addEventListener('click', function () { cms.deletePasskey(pk.id); });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  },

  fmtDuration: function (ms) {
    var total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    if (total < 60) return total + ' 秒';
    var mins = Math.floor(total / 60);
    if (mins < 60) return mins + ' 分钟';
    var hours = Math.floor(mins / 60);
    var restMin = mins % 60;
    if (hours < 24) return hours + ' 小时' + (restMin ? ' ' + restMin + ' 分钟' : '');
    var days = Math.floor(hours / 24);
    var restHour = hours % 24;
    return days + ' 天' + (restHour ? ' ' + restHour + ' 小时' : '');
  },

  fmtWhen: function (ts) {
    if (!ts) return '—';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '—';
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  },

  describeDevice: function (device) {
    var dev = device || {};
    var typeMap = { mobile: '手机', tablet: '平板', desktop: '电脑', bot: '程序' };
    var parts = [];
    if (dev.os) parts.push(dev.os);
    if (dev.browser) parts.push(dev.browser);
    var head = parts.join(' · ') || '未知设备';
    var type = typeMap[dev.type] || '设备';
    return { name: head, type: type };
  },

  sessionRow: function (s, ended) {
    var li = document.createElement('li');
    li.className = 'session-item';
    li.setAttribute('data-id', s.id || '');
    li.setAttribute('data-ip', s.ip || '');
    li.setAttribute('data-ended', ended ? '1' : '0');
    if (s.current) li.setAttribute('data-current', 'true');

    var dev = cms.describeDevice(s.device);
    var statusKey = s.status === 'online' ? 'online' : (s.status === 'ended' ? 'ended' : 'offline');
    var statusText = s.status === 'online' ? '在线' : (s.status === 'ended' ? '已离线' : '离线');

    var row = document.createElement('div');
    row.className = 'ss-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    var dot = document.createElement('span');
    dot.className = 'ss-dot';
    dot.setAttribute('data-status', statusKey);

    var main = document.createElement('div');
    main.className = 'ss-main';
    var name = document.createElement('div');
    name.className = 'ss-name';
    name.textContent = (s.label ? s.label + ' · ' : '') + dev.name + '（' + dev.type + '）';
    if (s.current) {
      var badge = document.createElement('span');
      badge.className = 'session-badge';
      badge.textContent = '当前设备';
      name.appendChild(badge);
    }
    var meta = document.createElement('div');
    meta.className = 'ss-meta';
    meta.textContent = [statusText, s.ip || '未知 IP', ended ? ('结束于 ' + cms.fmtWhen(s.endedAt)) : ('最近活动 ' + cms.fmtWhen(s.lastSeenAt))].join(' · ');
    main.appendChild(name);
    main.appendChild(meta);

    var chev = document.createElement('span');
    chev.className = 'ss-chevron';
    chev.textContent = '›';

    row.appendChild(dot);
    row.appendChild(main);
    row.appendChild(chev);

    var detail = document.createElement('div');
    detail.className = 'ss-detail';
    detail.hidden = true;

    var dl = document.createElement('dl');
    dl.className = 'ss-fields';
    var fields = [
      ['IP 地址', s.ip || '—'],
      ['IP 归属地', null],
      ['设备', dev.name + '（' + dev.type + '）'],
      [ended ? '持续时长' : '在线时长', cms.fmtDuration(s.durationMs)],
      ['首次登录', cms.fmtWhen(s.createdAt)],
      [ended ? '结束时间' : '最近活动', cms.fmtWhen(ended ? s.endedAt : s.lastSeenAt)]
    ];
    if (ended && s.reason) fields.push(['结束原因', s.reason]);
    fields.forEach(function (pair) {
      var wrap = document.createElement('div');
      wrap.className = 'ss-field';
      var dt = document.createElement('dt');
      dt.textContent = pair[0];
      var dd = document.createElement('dd');
      if (pair[1] === null) {
        dd.className = 'ss-geo';
        dd.textContent = '点击展开后查询…';
      } else {
        dd.textContent = pair[1];
      }
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });
    var uaWrap = document.createElement('div');
    uaWrap.className = 'ss-field ss-field--ua';
    var uaDt = document.createElement('dt');
    uaDt.textContent = 'User-Agent';
    var uaDd = document.createElement('dd');
    uaDd.textContent = s.ua || '（空）';
    uaWrap.appendChild(uaDt);
    uaWrap.appendChild(uaDd);
    dl.appendChild(uaWrap);

    var actions = document.createElement('div');
    actions.className = 'ss-actions';

    var labelInput = document.createElement('input');
    labelInput.className = 'field-input ss-label-input';
    labelInput.setAttribute('type', 'text');
    labelInput.setAttribute('maxlength', '24');
    labelInput.setAttribute('placeholder', '备注名，如：公司电脑');
    labelInput.value = s.label || '';
    var labelBtn = document.createElement('button');
    labelBtn.className = 'btn btn-sm';
    labelBtn.type = 'button';
    labelBtn.textContent = '保存备注';
    labelBtn.addEventListener('click', function () { cms.saveSessionLabel(li, ended); });

    actions.appendChild(labelInput);
    actions.appendChild(labelBtn);

    if (!ended && !s.current) {
      var kickBtn = document.createElement('button');
      kickBtn.className = 'btn btn-sm btn-danger';
      kickBtn.type = 'button';
      kickBtn.textContent = '踢下线';
      kickBtn.addEventListener('click', function () { cms.kickSession(li, s.id); });
      actions.appendChild(kickBtn);
    }

    var ipBtn = document.createElement('button');
    ipBtn.className = 'btn btn-sm';
    ipBtn.type = 'button';
    ipBtn.textContent = '封禁 IP';
    ipBtn.addEventListener('click', function () { cms.blockSession(li, s.id, 'ip'); });

    var devBtn = document.createElement('button');
    devBtn.className = 'btn btn-sm';
    devBtn.type = 'button';
    devBtn.textContent = '封禁设备';
    devBtn.addEventListener('click', function () { cms.blockSession(li, s.id, 'device'); });

    actions.appendChild(ipBtn);
    actions.appendChild(devBtn);

    detail.appendChild(dl);
    detail.appendChild(actions);

    row.addEventListener('click', function () { cms.toggleSession(li, s.ip); });
    row.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        cms.toggleSession(li, s.ip);
      }
    });

    li.appendChild(row);
    li.appendChild(detail);
    return li;
  },

  toggleSession: function (li, ip) {
    var detail = li.querySelector('.ss-detail');
    if (!detail) return;
    var open = !detail.hidden;
    detail.hidden = open;
    li.classList.toggle('is-open', !open);
    if (open) return;
    var geoEl = detail.querySelector('.ss-geo');
    if (!geoEl || geoEl.getAttribute('data-loaded') === '1') return;
    geoEl.setAttribute('data-loaded', '1');
    geoEl.textContent = '查询中…';
    if (!ip) { geoEl.textContent = '未知 IP'; return; }
    this.api('/api/auth/sessions/geo?ip=' + encodeURIComponent(ip)).then(function (res) {
      if (res && res.ok && res.label) {
        geoEl.textContent = res.label + (res.isp ? ' · ' + res.isp : '');
      } else {
        geoEl.textContent = (res && res.error) ? res.error : '归属地未知';
      }
    }).catch(function () { geoEl.textContent = '归属地查询失败'; });
  },

  applySessionOverview: function (data) {
    if (!data) return;
    this.renderSessions(data.sessions || [], data.history || [], data.blocked || []);
  },

  saveSessionLabel: function (li, ended) {
    var err = document.getElementById('session-error');
    err.textContent = '';
    var input = li.querySelector('.ss-label-input');
    var label = input ? String(input.value || '').trim() : '';
    this.api('/api/auth/sessions/rename', {
      method: 'POST',
      body: { id: li.getAttribute('data-id'), label: label, history: Boolean(ended) }
    }).then(function (res) {
      cms.applySessionOverview(res);
      cms.toast('备注已保存');
    }).catch(function (e) {
      err.textContent = e.message || '保存失败';
    });
  },

  kickSession: function (li, id) {
    var err = document.getElementById('session-error');
    err.textContent = '';
    if (!window.confirm('确定要让这个设备下线吗？')) return;
    this.api('/api/auth/sessions/revoke', { method: 'POST', body: { id: id } }).then(function (res) {
      cms.applySessionOverview(res);
      cms.toast('该设备已下线');
    }).catch(function (e) {
      err.textContent = e.message || '操作失败';
    });
  },

  blockSession: function (li, id, scope) {
    var err = document.getElementById('session-error');
    err.textContent = '';
    var what = scope === 'ip' ? '这个 IP 地址' : '这台设备';
    if (!window.confirm('把' + what + '加入黑名单？加入后它不能再登录后台。')) return;
    this.api('/api/auth/sessions/block', { method: 'POST', body: { id: id, scope: scope } }).then(function (res) {
      cms.applySessionOverview(res);
      cms.toast(scope === 'ip' ? 'IP 已加入黑名单' : '设备已加入黑名单');
    }).catch(function (e) {
      err.textContent = e.message || '操作失败';
    });
  },

  unblock: function (type, value) {
    var err = document.getElementById('session-error');
    err.textContent = '';
    this.api('/api/auth/blocklist/remove', { method: 'POST', body: { type: type, value: value } }).then(function (res) {
      cms.applySessionOverview(res);
      cms.toast('已解除封禁');
    }).catch(function (e) {
      err.textContent = e.message || '操作失败';
    });
  },

  renderBlocked: function (blocked) {
    var ul = document.getElementById('blocked-list');
    var countEl = document.getElementById('blocked-count');
    if (!ul) return;
    ul.innerHTML = '';
    if (countEl) countEl.textContent = blocked.length ? '共 ' + blocked.length + ' 条' : '';
    if (!blocked.length) {
      ul.innerHTML = '<li class="empty-tip">黑名单为空。可在会话详情里封禁可疑 IP 或设备。</li>';
      return;
    }
    blocked.forEach(function (b) {
      var li = document.createElement('li');
      li.className = 'session-item session-item--blocked';
      var main = document.createElement('div');
      main.className = 'ss-main';
      var name = document.createElement('div');
      name.className = 'ss-name';
      name.textContent = (b.type === 'ip' ? 'IP：' : '设备：') + (b.value || '');
      var meta = document.createElement('div');
      meta.className = 'ss-meta';
      meta.textContent = (b.note ? b.note + ' · ' : '') + '封禁于 ' + cms.fmtWhen(b.createdAt);
      main.appendChild(name);
      main.appendChild(meta);
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.type = 'button';
      btn.textContent = '解除封禁';
      btn.addEventListener('click', function () { cms.unblock(b.type, b.value); });
      li.appendChild(main);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  },

  renderSessions: function (sessions, history, blocked) {
    var ul = document.getElementById('session-list');
    var historyUl = document.getElementById('session-history');
    var countEl = document.getElementById('session-count');
    var onlineCount = document.getElementById('session-online-count');
    var historyCount = document.getElementById('session-history-count');
    var list = sessions || [];
    var hist = history || [];
    var online = list.filter(function (s) { return s.status === 'online'; }).length;
    if (countEl) countEl.textContent = '共 ' + list.length + ' 个有效会话 · ' + online + ' 个在线';
    if (onlineCount) onlineCount.textContent = String(list.length);
    if (historyCount) historyCount.textContent = hist.length ? String(hist.length) : '';
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="empty-tip">没有其它在线会话。</li>';
    } else {
      list.forEach(function (s) { ul.appendChild(cms.sessionRow(s, false)); });
    }
    if (historyUl) {
      historyUl.innerHTML = '';
      if (!hist.length) {
        historyUl.innerHTML = '<li class="empty-tip">还没有历史会话记录。</li>';
      } else {
        hist.forEach(function (s) { historyUl.appendChild(cms.sessionRow(s, true)); });
      }
    }
    this.renderBlocked(blocked || []);
  },

  addPasskey: async function () {
    var err = document.getElementById('passkey-error');
    err.textContent = '';
    if (!window.PublicKeyCredential || !navigator.credentials) {
      err.textContent = '当前浏览器或环境不支持通行密钥（需要 HTTPS 或 localhost）';
      return;
    }
    var label = window.prompt('给这个通行密钥起个名字（例如：MacBook 指纹）', '通行密钥');
    if (label === null) return;
    try {
      var optsData = await this.api('/api/auth/passkey/register-options', { method: 'POST', body: {} });
      var options = optsData.publicKey;
      options.challenge = b64uToBuffer(options.challenge);
      options.user.id = b64uToBuffer(options.user.id);
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map(function (c) {
          return { type: c.type, id: b64uToBuffer(c.id), transports: c.transports };
        });
      }
      var cred = await navigator.credentials.create({ publicKey: options });
      var payload = {
        label: label || '通行密钥',
        clientDataJSON: bufferToB64u(cred.response.clientDataJSON),
        attestationObject: bufferToB64u(cred.response.attestationObject),
        transports: typeof cred.response.getTransports === 'function' ? cred.response.getTransports() : []
      };
      await this.api('/api/auth/passkey/register', { method: 'POST', body: payload });
      this.notify('通行密钥已添加');
      this.loadSettings();
    } catch (e) {
      if (e && e.name === 'NotAllowedError') {
        err.textContent = '操作已取消，或超时未完成验证';
      } else {
        err.textContent = e.message === 'unauthorized' ? '' : ('添加失败：' + (e && e.message ? e.message : '未知错误'));
      }
    }
  },

  deletePasskey: async function (id) {
    var err = document.getElementById('passkey-error');
    err.textContent = '';
    var pwd = window.prompt('删除后该设备将无法用通行密钥登录。请输入当前密码确认：');
    if (!pwd) return;
    try {
      await this.api('/api/auth/passkey/delete', { method: 'POST', body: { id: id, password: pwd } });
      this.notify('通行密钥已删除');
      this.loadSettings();
    } catch (e) {
      err.textContent = e.message === 'unauthorized' ? '' : ('删除失败：' + e.message);
    }
  },

  probePasskeyLogin: async function () {
    var btn = document.getElementById('passkey-login-btn');
    btn.hidden = true;
    if (!window.PublicKeyCredential || !navigator.credentials) return;
    try {
      var res = await fetch(this.getApiUrl('/api/auth/passkey/login-options'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!res.ok) return;
      var data = await res.json();
      var allow = (data.publicKey && data.publicKey.allowCredentials) || [];
      btn.hidden = allow.length === 0;
    } catch (e) { /* 忽略 */ }
  },

  passkeyLogin: async function () {
    var errEl = document.getElementById('login-error');
    errEl.textContent = '';
    try {
      var optsRes = await fetch(this.getApiUrl('/api/auth/passkey/login-options'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      var optsData = await optsRes.json().catch(function () { return {}; });
      if (!optsRes.ok) throw new Error(optsData.error || '无法获取登录挑战');
      var options = optsData.publicKey;
      options.challenge = b64uToBuffer(options.challenge);
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map(function (c) {
          return { type: c.type, id: b64uToBuffer(c.id), transports: c.transports };
        });
      }
      var cred = await navigator.credentials.get({ publicKey: options });
      var payload = {
        credentialId: bufferToB64u(cred.rawId),
        clientDataJSON: bufferToB64u(cred.response.clientDataJSON),
        authenticatorData: bufferToB64u(cred.response.authenticatorData),
        signature: bufferToB64u(cred.response.signature),
        userHandle: cred.response.userHandle ? bufferToB64u(cred.response.userHandle) : ''
      };
      var res = await fetch(this.getApiUrl('/api/auth/passkey/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || ('登录失败 (HTTP ' + res.status + ')'));
      this.enterConsole(data.username);
    } catch (e) {
      if (e && e.name === 'NotAllowedError') {
        errEl.textContent = '已取消，或没有可用的通行密钥';
      } else {
        errEl.textContent = (e && e.message) ? e.message : '通行密钥登录失败';
      }
    }
  },

  escape: function (str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

/* ===== Markdown 增强：代码复制 / 灯箱 / 流程图（后台预览用） ===== */
(function () {
  var mask = null;
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
        '<div class="md-lightbox-bar"><span class="md-lightbox-lang"></span>' +
          '<div class="md-lightbox-actions">' +
            '<button type="button" class="md-lightbox-btn" data-action="copy">复制</button>' +
            '<button type="button" class="md-lightbox-btn" data-action="close">关闭</button>' +
          '</div>' +
        '</div>' +
        '<div class="md-lightbox-body"></div>' +
      '</div>';
    mask.addEventListener('click', function (event) {
      if (event.target === mask) return close();
      var action = event.target.closest('[data-action]');
      if (!action) return;
      if (action.getAttribute('data-action') === 'close') return close();
      copyText(codeText(mask.querySelector('.md-lightbox-body code'))).then(function (ok) { flash(action, ok ? '已复制' : '复制失败'); });
    });
    document.body.appendChild(mask);
    return mask;
  }

  function open(lang, html) {
    var box = ensureMask();
    box.querySelector('.md-lightbox-lang').textContent = lang || 'text';
    box.querySelector('.md-lightbox-body').innerHTML = html;
    box.className = 'md-lightbox is-open is-code';
    document.body.classList.add('md-lightbox-locked');
  }

  function close() {
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
      open(target.getAttribute('data-lang'), pre ? pre.outerHTML : '');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close();
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
          flowchart: { htmlLabels: true, curve: 'basis' }
        });
        return api;
      })
      .catch(function () { return null; });
    return mermaidLoading;
  }

  var seq = 0;
  var timer = null;
  function renderMermaid() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid:not([data-rendered])'));
    if (!nodes.length) return;
    nodes.forEach(function (node) { node.setAttribute('data-rendered', '1'); });
    loadMermaid().then(function (api) {
      if (!api) {
        nodes.forEach(function (node) { node.classList.add('mermaid-error'); });
        return;
      }
      nodes.forEach(function (node) {
        api.render('admin-mermaid-' + (++seq), node.textContent || '').then(function (result) {
          node.innerHTML = result.svg;
          node.classList.add('mermaid-done');
        }).catch(function () { node.classList.add('mermaid-error'); });
      });
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(renderMermaid, 80);
  }

  if (window.MutationObserver) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('load', schedule);
})();

// 回到顶部：内容超过一屏时出现
(function initBackToTop() {
  var btn = document.getElementById('back-to-top');
  if (!btn) return;
  function update() {
    var scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
    var extra = document.documentElement.scrollHeight - window.innerHeight;
    btn.setAttribute('data-show', (scrolled > 260 && extra > 220) ? 'true' : 'false');
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  setTimeout(update, 300);
  window.__refreshBackToTop = update;
})();

cms.init();
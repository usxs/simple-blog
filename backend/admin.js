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
  var avatarEl = document.getElementById('site-avatar');
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

function sortNewestFirst(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().sort(function (a, b) {
    var ta = Number(a && a.mtime) || 0;
    var tb = Number(b && b.mtime) || 0;
    if (tb !== ta) return tb - ta;
    var da = String((a && a.date) || '');
    var db = String((b && b.date) || '');
    if (db !== da) return db.localeCompare(da);
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
  tools: { name: '工具', icon: 'wrench' },
  probe: { name: '探针', icon: 'activity' },
  status: { name: '状态', icon: 'heart' },
  quirky: { name: '奇奇怪怪', icon: 'star' }
};

var MODULE_ORDER = ['home', 'posts', 'moments', 'tools', 'probe', 'status', 'quirky'];

// 图标值可能是预设名，也可能是 /img/... 或 http(s) 地址
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
  iconTarget: null,
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

    // 「管理」是独立页面，不参与列表 / 编辑器布局
    var isSettings = m === 'settings';
    var grid = document.querySelector('.cms-grid');
    var settingsEl = document.getElementById('admin-settings');
    if (grid) grid.style.display = isSettings ? 'none' : '';
    if (settingsEl) settingsEl.hidden = !isSettings;
    // 存储路径提示只属于内容类页面，「管理」页不显示
    var hintEl = document.getElementById('storage-hint');
    if (isSettings) {
      if (hintEl) hintEl.style.display = 'none';
      this.loadSettings();
      return;
    }
    if (hintEl) hintEl.style.display = '';

    document.getElementById('list-title').textContent = SCHEMAS[m].label + '列表';
    document.getElementById('storage-hint').textContent = SCHEMAS[m].storageHint;
    document.getElementById('probe-now-btn').style.display = m === 'status' ? 'inline-block' : 'none';
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

  loadSettings: async function () {
    var pkeys = [];
    try {
      var data = await this.api('/api/admin/overview?_t=' + Date.now());
      var site = data.site || {};
      document.getElementById('site-name').value = site.name || '';
      document.getElementById('site-avatar').value = site.avatarText || '';
      document.getElementById('site-title').value = site.title || '';
      document.getElementById('site-subtitle').value = site.subtitle || '';
      this.applyModuleConfig(site.modules);
      this.renderModules();

      document.getElementById('account-username').value = data.username || '';

      var totpOn = Boolean(data.totp && data.totp.enabled);
      this.renderTotpState(totpOn);

      pkeys = data.passkeys || [];
      this.renderPasskeys(pkeys);

      this.renderSessions(data.sessions || []);
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
  applyModuleConfig: function (modules) {
    var self = this;
    this.modules = this.normalizeModules(modules);
    MODULE_ORDER.forEach(function (key) {
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

  saveModules: async function (patch, okText) {
    var err = document.getElementById('module-error');
    if (err) err.textContent = '';
    try {
      var out = await this.api('/api/admin/site', { method: 'POST', body: { modules: patch } });
      var saved = out && out.site && out.site.modules ? out.site.modules : this.modules;
      this.applyModuleConfig(saved);
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
    list.innerHTML = MODULE_ORDER.map(function (key) {
      var m = self.modules[key];
      var fallback = MODULE_FALLBACK[key];
      var fixed = key === 'home';
      var route = String(m.route || key || '');
      var fixed = key === 'home';
      return '<li class="module-row" data-module="' + key + '" data-disabled="' + (m.enabled ? 'false' : 'true') + '">' +
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
        subtitle: document.getElementById('site-subtitle').value.trim()
      };
      if (!payload.name) { err.textContent = '站点名称不能为空'; return; }
      try {
        var out = await self.api('/api/admin/site', { method: 'POST', body: payload });
        var site = out.site || payload;
        document.getElementById('site-name').value = site.name;
        document.getElementById('site-avatar').value = site.avatarText;
        document.getElementById('site-title').value = site.title;
        document.getElementById('site-subtitle').value = site.subtitle;
        self.notify('站点信息已保存，前台刷新后生效');
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

  renderSessions: function (sessions) {
    var ul = document.getElementById('session-list');
    ul.innerHTML = '';
    document.getElementById('session-count').textContent = '共 ' + sessions.length + ' 个在线会话';
    if (!sessions.length) {
      ul.innerHTML = '<li class="empty-tip">没有其它在线会话。</li>';
      return;
    }
    sessions.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'session-item';
      li.setAttribute('data-current', s.current ? 'true' : 'false');
      var seen = s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString('zh-CN') : '—';
      li.innerHTML = '<div class="ss-main"><div class="ss-name">' + cms.escape(s.ua || '未知设备') +
        '</div><div class="ss-meta">' + cms.escape(s.ip || '未知 IP') + ' · 最近活动 ' + cms.escape(seen) + '</div></div>' +
        (s.current ? '<span class="session-badge">当前设备</span>' : '');
      ul.appendChild(li);
    });
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

cms.init();
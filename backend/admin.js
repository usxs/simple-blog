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

var cms = {
  mod: 'posts',
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
      if (!username || !password) {
        errEl.textContent = '请输入用户名和密码';
        return;
      }
      try {
        var res = await fetch(self.getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          errEl.textContent = (data && data.error) ? data.error : ('登录失败 (HTTP ' + res.status + ')');
          return;
        }
        document.getElementById('login-password').value = '';
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
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  ipRateStore,
  getClientIp,
  generateMathCaptcha,
  verifyMathCaptcha
} = require('./backend/captcha');

const auth = require('./backend/auth');
const { buildSitemap, PUBLIC_SITE_URL } = require('./backend/sitemap');
const { notifyIndexNow } = require('./backend/indexnow');
const image = require('./backend/image');

const {
  ROOT_DIR,
  ARTICLE_DIR,
  MUSINGS_DIR,
  IMG_DIR,
  FILE_DIR,
  getDateFolder,
  sanitizeFileName,
  sanitizeId,
  buildMdContent,
  readArticles,
  readPostComments,
  savePostComments,
  collectCascadeIds,
  readAllCommentsAcrossArticles,
  readMusings,
  getConfig,
  saveConfig,
  getHash,
  getModuleData
} = require('./backend/storage');

const {
  runAllProbes,
  startProbeScheduler
} = require('./backend/probe');

const PORT = Number(process.env.PORT) || 33001;

// 可选的服务器探针数据源（兼容 CF-Server-Monitor 的 /api/servers 接口）。
// 不配置时 /api/probe-servers 返回 501，前端探针页只显示自身配置的站点监控。
const PROBE_SERVERS_URL = String(process.env.PROBE_SERVERS_URL || '').trim();

// 中国大陆时区（Asia/Shanghai, UTC+8）：评论时间、文章日期等统一按北京时间生成，
// 不依赖容器/宿主机的系统时区设置（toISOString 恒为 UTC，会导致北京时间 0~8 点
// 写下的日期比实际晚一天，故全部改用显式时区格式化）
const CN_TIMEZONE = 'Asia/Shanghai';
const cnDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});
const cnTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CN_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false
});
// 'YYYY-MM-DD'（北京时间）
function cnTodayStamp() {
  return cnDateFmt.format(new Date());
}
// 'YYYY-MM-DD HH:mm'（北京时间）
function cnNowStamp() {
  return cnDateFmt.format(new Date()) + ' ' + cnTimeFmt.format(new Date());
}

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg'
};

startProbeScheduler();

// 鉴权守卫：先判 CSRF（跨站写请求 → 403），再判登录态（→ 401）
function guardAuth(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !auth.assertSameOrigin(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: '拒绝跨站请求' }));
    return false;
  }
  if (!auth.isAuthenticated(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

function serveStaticAsset(req, res, baseDir, urlPrefix) {
  const relPath = decodeURIComponent(req.url.split('?')[0].slice(urlPrefix.length));
  const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(baseDir, safePath);

  if (!fullPath.startsWith(baseDir) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('File Not Found');
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000'
  });
  fs.createReadStream(fullPath).pipe(res);
}

function serveSingleFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not Found');
  }
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(filePath, 'utf8'));
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';

  // 公开接口与静态资源：跨域放行（前端主站跨域调用）
  // /api/auth/* 与管理接口：不设置 CORS 头，仅限同源（配合 SameSite=Strict Cookie）
  const isOpenCors = pathname === '/' ||
    pathname.startsWith('/api/captcha') ||
    pathname.startsWith('/api/site') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/sync') ||
    pathname.startsWith('/api/probe-servers') ||
    pathname.startsWith('/img/') ||
    pathname.startsWith('/file/');
  if (isOpenCors) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && pathname.startsWith('/img/')) {
    return serveStaticAsset(req, res, IMG_DIR, '/img/');
  }
  if (req.method === 'GET' && pathname.startsWith('/file/')) {
    return serveStaticAsset(req, res, FILE_DIR, '/file/');
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Accel-Expires', '0');

  // 1. 后台页面与分离后的静态资源 (/admin, /admin.css, /admin.js)
  if (req.method === 'GET' && (pathname === '/admin' || pathname === '/admin.html')) {
    return serveSingleFile(res, path.join(ROOT_DIR, 'admin.html'), MIME_MAP['.html']);
  }
  if (req.method === 'GET' && pathname === '/admin.css') {
    return serveSingleFile(res, path.join(ROOT_DIR, 'admin.css'), MIME_MAP['.css']);
  }
  if (req.method === 'GET' && pathname === '/admin.js') {
    return serveSingleFile(res, path.join(ROOT_DIR, 'admin.js'), MIME_MAP['.js']);
  }
  if (req.method === 'GET' && pathname === '/markdown.js') {
    return serveSingleFile(res, path.join(ROOT_DIR, 'markdown.js'), MIME_MAP['.js']);
  }

  // 2. 根路径返回 200 状态
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ code: 200, message: 'API Server is running correctly.' }));
  }

  // 2.5 sitemap：搜索引擎专用。内容只含前端主站（Cloudflare Pages）页面，
  //     每次请求实时构建——发布/删除文章后立即生效，无需手动更新。
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    return res.end(buildSitemap());
  }

  // 2.6 robots：本域名（后端）除 sitemap 外全部禁止抓取——后台登录页、
  //     管理接口、评论数据等都不暴露给搜索引擎
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(
      '# 后端 API 域名：仅提供 sitemap 文件，其余路径一律禁止抓取\n' +
      'User-agent: *\n' +
      'Allow: /sitemap.xml\n' +
      'Disallow: /\n' +
      '\n' +
      'Sitemap: ' + (process.env.BACKEND_PUBLIC_URL || 'https://api.example.com').replace(/\/+$/, '') + '/sitemap.xml\n'
    );
  }

  // 3. 获取算术验证码: GET /api/captcha
  if (req.method === 'GET' && pathname === '/api/captcha') {
    const cap = generateMathCaptcha();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(cap));
  }

  // 3.1 认证状态: GET /api/auth/status
  if (req.method === 'GET' && pathname === '/api/auth/status') {
    return auth.handleStatus(req, res);
  }

  // 3.2 首次初始化管理员: POST /api/auth/setup（仅凭据不存在时可用一次）
  if (req.method === 'POST' && pathname === '/api/auth/setup') {
    return auth.handleSetup(req, res);
  }

  // 3.3 账密登录: POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    return auth.handleLogin(req, res);
  }

  // 3.4 退出登录: POST /api/auth/logout
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    return auth.handleLogout(req, res);
  }

  // 3.5 修改密码: POST /api/auth/change-password（成功后吊销其它会话并轮换当前会话）
  if (req.method === 'POST' && pathname === '/api/auth/change-password') {
    return auth.handleChangePassword(req, res);
  }

  // 3.6 站点展示信息（公开）: GET /api/site —— 前端启动时读取名称/标题/副标题
  if (req.method === 'GET' && pathname === '/api/site') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate'
    });
    return res.end(JSON.stringify({ ok: true, site: auth.getSiteInfo() }));
  }

  // 3.7 后台总览: GET /api/admin/overview
  if (req.method === 'GET' && pathname === '/api/admin/overview') {
    if (!guardAuth(req, res)) return;
    return auth.handleAdminOverview(req, res);
  }

  // 3.8 保存站点信息: POST /api/admin/site
  if (req.method === 'POST' && pathname === '/api/admin/site') {
    if (!guardAuth(req, res)) return;
    return auth.handleSiteSave(req, res);
  }

  // 3.9 修改管理员用户名: POST /api/auth/change-username
  if (req.method === 'POST' && pathname === '/api/auth/change-username') {
    if (!guardAuth(req, res)) return;
    return auth.handleChangeUsername(req, res);
  }

  // 3.10 两步验证（TOTP）
  if (req.method === 'POST' && pathname === '/api/auth/totp/setup') {
    if (!guardAuth(req, res)) return;
    return auth.handleTotpSetup(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/totp/enable') {
    if (!guardAuth(req, res)) return;
    return auth.handleTotpEnable(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/totp/disable') {
    if (!guardAuth(req, res)) return;
    return auth.handleTotpDisable(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/backup-codes') {
    if (!guardAuth(req, res)) return;
    return auth.handleBackupCodes(req, res);
  }

  // 3.11 通行密钥（Passkey / WebAuthn）
  if (req.method === 'GET' && pathname === '/api/auth/passkeys') {
    if (!guardAuth(req, res)) return;
    return auth.handlePasskeyList(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/passkey/register-options') {
    if (!guardAuth(req, res)) return;
    return auth.handlePasskeyRegisterOptions(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/passkey/register') {
    if (!guardAuth(req, res)) return;
    return auth.handlePasskeyRegister(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/passkey/delete') {
    if (!guardAuth(req, res)) return;
    return auth.handlePasskeyDelete(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/passkey/login-options') {
    if (!auth.assertSameOrigin(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '拒绝跨站请求' }));
    }
    return auth.handlePasskeyLoginOptions(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/passkey/login') {
    if (!auth.assertSameOrigin(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '拒绝跨站请求' }));
    }
    return auth.handlePasskeyLogin(req, res);
  }

  // 3.12 登录会话管理
  if (req.method === 'GET' && pathname === '/api/auth/sessions') {
    if (!guardAuth(req, res)) return;
    return auth.handleSessionsList(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/auth/sessions/revoke-others') {
    if (!guardAuth(req, res)) return;
    return auth.handleSessionsRevokeOthers(req, res);
  }

  // 4. 前端获取某篇文章已审核通过的评论（支持层中层 parentId 及站长回复）
  if (req.method === 'GET' && pathname === '/api/comments') {
    const postId = String(reqUrl.searchParams.get('postId') || '').trim();
    if (!postId) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, data: [] }));
    }
    const postComments = readPostComments(postId);
    const approvedIds = new Set(postComments.filter(c => c.status === 'approved').map(c => String(c.id)));

    // 仅当自身通过审核，且若有父评论时父评论也通过审核，才对外展示
    const approved = postComments
      .filter(c => c.status === 'approved' && (!c.parentId || approvedIds.has(String(c.parentId))))
      .map(c => ({
        id: c.id,
        postId: postId,
        parentId: c.parentId || '',
        parentAuthor: c.parentAuthor || '',
        author: c.author,
        date: c.date,
        mtime: c.mtime || 0,
        content: c.content,
        isAdmin: Boolean(c.isAdmin),
        replyContent: c.replyContent || '',
        replyAuthor: c.replyAuthor || '',
        replyDate: c.replyDate || '',
        isAdminReply: Boolean(c.replyContent)
      }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, data: approved }));
  }

  // 5. 前端访客提交评论或回复任意评论（依旧进入 pending 待审核）
  if (req.method === 'POST' && pathname === '/api/comments/submit') {
    const ip = getClientIp(req);
    const now = Date.now();
    const rec = ipRateStore.get(ip) || { lastSubmit: 0, countHour: 0, failCount: 0, blockedUntil: 0, lastActive: now };

    if (now < rec.blockedUntil) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '请求过于频繁或错误次数过多，请 15 分钟后再试' }));
    }

    if (now - rec.lastSubmit < 60 * 1000) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '发送太快啦，请等待 60 秒后再发送下一条评论' }));
    }

    if (now - rec.lastActive > 3600 * 1000) {
      rec.countHour = 0;
    }
    if (rec.countHour >= 10) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '当前 IP 每小时评论次数已达上限，请稍后再试' }));
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 32 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (data.website_hp) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true }));
        }

        if (!verifyMathCaptcha(data.captchaToken, data.captchaAnswer)) {
          rec.failCount += 1;
          rec.lastActive = now;
          if (rec.failCount >= 5) {
            rec.blockedUntil = now + 15 * 60 * 1000;
            rec.failCount = 0;
          }
          ipRateStore.set(ip, rec);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: '算术验证码答案错误或已过期，请重算' }));
        }

        const postId = sanitizeId(data.postId || '');
        const parentId = String(data.parentId || '').trim().slice(0, 64);
        const rawParentAuthor = String(data.parentAuthor || '').trim().slice(0, 32);
        const author = String(data.author || '').trim().slice(0, 32);
        const contact = String(data.contact || '').trim().slice(0, 80);
        const content = String(data.content || '').trim().slice(0, 1000);

        if (!postId || !author || !content) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: '昵称和评论内容不能为空' }));
        }

        const postFolder = path.join(ARTICLE_DIR, postId);
        if (!fs.existsSync(postFolder)) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: '目标文章不存在' }));
        }

        const postComments = readPostComments(postId);
        let validParentId = '';
        let validParentAuthor = '';

        if (parentId) {
          const parentComment = postComments.find(c => String(c.id) === parentId && c.status === 'approved');
          if (!parentComment) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ ok: false, error: '要回复的目标评论不存在或尚未通过审核' }));
          }
          validParentId = parentComment.id;
          validParentAuthor = rawParentAuthor || parentComment.author || '匿名访客';
        }

        rec.lastSubmit = now;
        rec.lastActive = now;
        rec.countHour += 1;
        rec.failCount = 0;
        ipRateStore.set(ip, rec);

        const newComment = {
          id: 'cmt-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
          postId: postId,
          parentId: validParentId,
          parentAuthor: validParentAuthor,
          author: author,
          contact: contact,
          content: content,
          ip: ip,
          date: cnNowStamp(),
          mtime: now,
          status: 'pending',
          replyAuthor: '',
          replyContent: '',
          replyDate: ''
        };
        postComments.unshift(newComment);
        savePostComments(postId, postComments);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: '请求格式错误' }));
      }
    });
    return;
  }

  // 6. 校验登录会话
  if (req.method === 'GET' && pathname === '/api/verify') {
    const session = auth.getSession(req);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false }));
    }
    const state = auth.getAuthState();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, username: state.username }));
  }

  // 7. 上传图片与文件接口
  if (req.method === 'POST' && pathname === '/api/upload') {
    if (!guardAuth(req, res)) return;

    const chunks = [];
    let totalBytes = 0;
    const MAX_BYTES = 80 * 1024 * 1024;

    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(bodyStr);
        const kind = payload.kind === 'image' ? 'image' : 'file';
        const rawName = String(payload.filename || (kind === 'image' ? 'image.png' : 'attachment.bin'));
        const base64Data = String(payload.data || '').replace(/^data:[^;]+;base64,/, '');

        if (!base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'Empty file data' }));
        }

        const dateFolder = getDateFolder();
        const rootTargetDir = kind === 'image' ? IMG_DIR : FILE_DIR;
        const urlPrefix = kind === 'image' ? '/img' : '/file';
        const targetDir = path.join(rootTargetDir, dateFolder);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        let fileBuf = Buffer.from(base64Data, 'base64');

        // 图片自动优化：转 WebP + 适当压缩（失败自动回退原格式）；附件不做转换
        let finalName = sanitizeFileName(rawName);
        let converted = false;
        if (kind === 'image') {
          const webp = await image.optimizeToWebp(fileBuf, path.extname(rawName).toLowerCase());
          if (webp) {
            fileBuf = webp.buffer;
            finalName = image.replaceExtWithWebp(finalName);
            converted = true;
          }
        }

        // 命名沿用「时间戳-原名」排列；当日重复时在扩展名前追加 -1、-2 ……
        finalName = image.uniqueFileName(targetDir, finalName);
        fs.writeFileSync(path.join(targetDir, finalName), fileBuf);

        const proto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers['host'] || ('127.0.0.1:' + PORT);
        const relativeUrl = `${urlPrefix}/${dateFolder}/${finalName}`;
        const fullUrl = `${proto}://${host}${relativeUrl}`;

        const displayLabel = path.basename(rawName, path.extname(rawName)) || finalName;
        const markdown = kind === 'image'
          ? `![${displayLabel}](${fullUrl})`
          : `[${rawName}](${fullUrl})`;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          kind: kind,
          filename: finalName,
          converted: converted,
          dateFolder: dateFolder,
          url: fullUrl,
          relativeUrl: relativeUrl,
          markdown: markdown
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Upload parse error' }));
      }
    });
    return;
  }

  // 8. 手动触发探针
  if (req.method === 'POST' && pathname === '/api/probe-now') {
    if (!guardAuth(req, res)) return;
    runAllProbes().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // 8.5 读取外部服务器监控列表（可选，需配置 PROBE_SERVERS_URL）
  if (req.method === 'GET' && pathname === '/api/probe-servers') {
    if (!PROBE_SERVERS_URL) {
      res.writeHead(501, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: '未配置 PROBE_SERVERS_URL，探针数据源未启用' }));
    }
    const upstream = https.get(PROBE_SERVERS_URL, { timeout: 8000 }, (upstreamRes) => {
      let body = '';
      upstreamRes.setEncoding('utf8');
      upstreamRes.on('data', chunk => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) upstream.destroy(new Error('Monitor response too large'));
      });
      upstreamRes.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Monitor response interrupted' }));
        }
      });
      upstreamRes.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (upstreamRes.statusCode < 200 || upstreamRes.statusCode >= 300 || !Array.isArray(payload.servers)) {
            res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Monitor API returned an invalid response' }));
          }
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=30'
          });
          res.end(JSON.stringify(payload));
        } catch (e) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Unable to parse monitor response' }));
        }
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Monitor API timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Unable to reach monitor API' }));
      }
    });
    return;
  }

  // 9. 同步接口
  if (req.method === 'GET' && pathname === '/api/sync') {
    const mod = reqUrl.searchParams.get('module') || 'posts';
    if (mod === 'comments' && !guardAuth(req, res)) return;
    const clientVer = reqUrl.searchParams.get('version') || '';
    const list = getModuleData(mod);
    const serverVer = getHash(list);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    if (clientVer && clientVer === serverVer) {
      return res.end(JSON.stringify({ updated: false, version: serverVer, data: list }));
    }
    return res.end(JSON.stringify({ updated: true, version: serverVer, data: list }));
  }

  // 9.5 公开单篇内容端点：供 Cloudflare Pages Functions 服务端渲染文章页使用（无需鉴权，可缓存）
  if (req.method === 'GET' && pathname.startsWith('/api/public/post/')) {
    let postId = '';
    try {
      postId = sanitizeId(decodeURIComponent(pathname.slice('/api/public/post/'.length)));
    } catch (e) {
      postId = '';
    }
    const found = readArticles().find(p => String(p.id) === postId);
    if (!found) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Not Found' }));
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    });
    return res.end(JSON.stringify({ ok: true, post: found }));
  }

  // 10. 保存、回复评论与审核接口
  if (req.method === 'POST' && pathname === '/api/save') {
    if (!guardAuth(req, res)) return;

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const mod = parsed.module;
        const item = parsed.item || {};

        if (mod === 'posts') {
          item.id = sanitizeId(item.id || item.title || ('post-' + Date.now()));
          const postSubDir = path.join(ARTICLE_DIR, item.id);
          const mdFilePath = path.join(postSubDir, item.id + '.md');
          const isNew = !fs.existsSync(mdFilePath);

          if (!fs.existsSync(postSubDir)) {
            fs.mkdirSync(postSubDir, { recursive: true });
          }

          item.date = item.date || cnTodayStamp();
          if (isNew || !item.mtime) item.mtime = Date.now();
          fs.writeFileSync(mdFilePath, buildMdContent(item, 'posts'), 'utf8');

          const cmtPath = path.join(postSubDir, 'comments.json');
          if (!fs.existsSync(cmtPath)) {
            fs.writeFileSync(cmtPath, JSON.stringify([], null, 2), 'utf8');
          }

          // IndexNow 即时推送（Bing 等），fire-and-forget
          notifyIndexNow(PUBLIC_SITE_URL + '/post/' + encodeURIComponent(String(item.id)));

          const list = readArticles();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, item: item, data: list, version: getHash(list) }));
        }

        if (mod === 'moments') {
          const isNew = !item.id || !fs.existsSync(path.join(MUSINGS_DIR, sanitizeId(item.id) + '.md'));
          item.id = sanitizeId(item.id || ('musing-' + Date.now()));
          item.date = item.date || cnNowStamp();
          if (isNew || !item.mtime) item.mtime = Date.now();
          fs.writeFileSync(path.join(MUSINGS_DIR, item.id + '.md'), buildMdContent(item, 'moments'), 'utf8');
          const list = readMusings();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, item: item, data: list, version: getHash(list) }));
        }

        if (mod === 'comments') {
          const postId = sanitizeId(item.postId || '');
          if (!postId || !item.id) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Missing postId or comment id' }));
          }
          const postComments = readPostComments(postId);
          const idx = postComments.findIndex(c => String(c.id) === String(item.id));
          if (idx === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Comment not found' }));
          }

          const target = postComments[idx];
          if (item.status) target.status = item.status;
          if (item.replyContent !== undefined) {
            target.replyContent = String(item.replyContent || '').trim();
            target.replyAuthor = String(item.replyAuthor || '简单博客').trim() || '简单博客';
            target.replyDate = target.replyContent
              ? (cnNowStamp())
              : '';
          }

          postComments[idx] = target;
          savePostComments(postId, postComments);

          const all = readAllCommentsAcrossArticles();
          const updatedTarget = all.find(c => String(c.id) === String(item.id)) || target;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, item: updatedTarget, data: all, version: getHash(all) }));
        }

        const cfg = getConfig();
        if (!Array.isArray(cfg[mod])) cfg[mod] = [];
        item.id = item.id ? String(item.id) : String(Date.now());

        const idx = cfg[mod].findIndex(i => String(i.id) === String(item.id));
        if (idx !== -1) {
          cfg[mod][idx] = Object.assign({}, cfg[mod][idx], item);
        } else {
          cfg[mod].unshift(item);
        }
        saveConfig(cfg);

        if (mod === 'status') await runAllProbes();

        const updatedCfg = getConfig();
        const list = updatedCfg[mod] || [];
        const savedItem = list.find(i => String(i.id) === String(item.id)) || item;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, item: savedItem, data: list, version: getHash(list) }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 11. 删除接口（删除父评论时自动级联清理其下属的层中层子回复）
  if (req.method === 'POST' && pathname === '/api/delete') {
    if (!guardAuth(req, res)) return;

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const mod = parsed.module;
        const id = parsed.id;

        if (mod === 'posts') {
          const postSubDir = path.join(ARTICLE_DIR, sanitizeId(id));
          if (fs.existsSync(postSubDir)) {
            fs.rmSync(postSubDir, { recursive: true, force: true });
          }
          // 通知 IndexNow 该文章地址已移除（fire-and-forget）
          notifyIndexNow(PUBLIC_SITE_URL + '/post/' + encodeURIComponent(String(sanitizeId(id))));
          const list = readArticles();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, data: list, version: getHash(list) }));
        }

        if (mod === 'moments') {
          const filePath = path.join(MUSINGS_DIR, sanitizeId(id) + '.md');
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          const list = readMusings();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, data: list, version: getHash(list) }));
        }

        if (mod === 'comments') {
          const postId = sanitizeId(parsed.postId || '');
          if (postId) {
            const list = readPostComments(postId);
            const cascadeSet = collectCascadeIds(list, id);
            const filtered = list.filter(c => !cascadeSet.has(String(c.id)));
            savePostComments(postId, filtered);
          } else {
            const entries = fs.readdirSync(ARTICLE_DIR, { withFileTypes: true });
            entries.forEach(ent => {
              if (ent.isDirectory()) {
                const list = readPostComments(ent.name);
                const cascadeSet = collectCascadeIds(list, id);
                const next = list.filter(c => !cascadeSet.has(String(c.id)));
                if (next.length !== list.length) savePostComments(ent.name, next);
              }
            });
          }
          const all = readAllCommentsAcrossArticles();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: true, data: all, version: getHash(all) }));
        }

        const cfg = getConfig();
        if (Array.isArray(cfg[mod])) {
          cfg[mod] = cfg[mod].filter(i => String(i.id) !== String(id));
          saveConfig(cfg);
        }
        const list = cfg[mod] || [];
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, data: list, version: getHash(list) }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Backend server listening on http://127.0.0.1:' + PORT);
});
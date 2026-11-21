/**
 * backend/auth.js — 管理员账密认证模块（现代标准，零第三方依赖）
 *
 * 设计要点（全部基于 Node 原生 crypto）：
 * 1. 口令存储：scrypt（内存困难型 KDF，N=2^14, r=8, p=1, 64 字节输出）+ 每口令独立 16 字节
 *    随机盐，落盘格式 "scrypt$N$r$p$salt$hash"；验证使用 crypto.timingSafeEqual 恒定时间比较。
 * 2. 会话：服务端会话表持久化在 data/sessions.json；Cookie 只存放 256bit 随机 Token，
 *    服务端仅保存 Token 的 SHA-256 摘要 —— 即使会话文件泄露也无法冒用。
 *    Cookie 属性：HttpOnly + SameSite=Strict + (HTTPS 时) Secure，前端 JS 无法读取。
 * 3. 有效期：滑动 7 天（活跃自动续期，写盘节流 1 小时一次）+ 绝对上限 30 天，过期自动清理。
 * 4. 登录限流：按 IP 记录失败次数，15 分钟内失败 5 次锁定 15 分钟；登录失败一律返回
 *    「用户名或密码错误」，且对未知用户名同样执行 scrypt 计算，防止时序侧信道枚举用户名。
 * 5. CSRF 防护：Cookie SameSite=Strict；所有非 GET 管理接口额外校验 Origin / Sec-Fetch-Site 同源。
 * 6. 首次部署引导：优先使用 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量初始化（仅当凭据不存在时
 *    生效一次）；否则开放 POST /api/auth/setup 一次性初始化，创建成功后永久关闭该入口。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./storage');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_COOKIE = 'console_session';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;   // 滑动有效期 7 天
const SESSION_MAX_MS = 30 * 24 * 3600 * 1000;  // 绝对上限 30 天
const SESSION_RENEW_GAP_MS = 3600 * 1000;      // 续期写盘节流间隔
const MAX_SESSIONS = 100;                      // 会话数量上限（超出淘汰最久未活跃）

const LOGIN_FAIL_LIMIT = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

// 数据目录可用性：不可写时服务照常启动（公开接口不受影响），
// 仅登录/初始化等需要落盘的接口返回 503，并打印一次可执行的修复命令
let DATA_WRITABLE = true;
let DATA_DIR_WARNED = false;

function warnDataDirBroken(err) {
  DATA_WRITABLE = false;
  if (DATA_DIR_WARNED) return;
  DATA_DIR_WARNED = true;
  const code = (err && err.code) || 'EIO';
  console.error(`[auth] 管理员数据目录不可写（${code}）: ${DATA_DIR}`);
  console.error('[auth] 登录/初始化功能暂不可用，站点公开接口不受影响。');
  console.error('[auth] 修复方法（在宿主机、docker compose 所在目录执行）:');
  console.error('[auth]   mkdir -p <宿主机 data 目录> && chown -R 1000:1000 <宿主机 data 目录>');
  console.error('[auth]   确认 docker-compose.yml 的 volumes 含 "- <宿主机 data 目录>:/app/data"');
  console.error('[auth]   然后: docker compose up -d --force-recreate');
}

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // mkdir 对「已存在但不可写」的目录会静默成功（如宿主机目录属主是 root），
    // 必须用真实写入探测：探测通过才认为可写，否则 setup/login 会拿到假阳性后崩溃
    const probe = path.join(DATA_DIR, '.probe-' + process.pid);
    fs.writeFileSync(probe, '1', { encoding: 'utf8', mode: 0o600 });
    fs.unlinkSync(probe);
    DATA_WRITABLE = true;
  } catch (e) {
    warnDataDirBroken(e);
  }
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJsonAtomic(file, obj) {
  ensureDataDir();
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (e) {
    warnDataDirBroken(e);
    throw e; // 由调用方决定如何降级
  }
}

function sha256hex(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

// 恒定时间字符串比较：先散列再比较，规避长度差异导致的提前返回
function timingSafeEqualStr(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function scryptHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function scryptVerify(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    const actual = crypto.scryptSync(String(password), salt, expected.length, { N, r, p });
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

// 启动时预计算的哑哈希：对不存在的用户名也执行同等 scrypt 计算，抹平时序差异
const DUMMY_HASH = scryptHash('dummy-password-for-timing-equality');

// ---------------------------------------------------------------------------
// 凭据存取
// ---------------------------------------------------------------------------

function getCreds() {
  // 凭据文件存在但损坏 → 返回 null 但 setupNeeded 也为 false（fail-closed，拒绝一切登录）
  if (fs.existsSync(AUTH_FILE)) {
    const raw = readJsonSafe(AUTH_FILE, null);
    if (raw && raw.username && raw.hash) {
      return { username: String(raw.username), hash: String(raw.hash), createdAt: raw.createdAt || 0, updatedAt: raw.updatedAt || 0 };
    }
    return null;
  }
  return undefined; // 从未初始化
}

function getAuthState() {
  const creds = getCreds();
  return {
    // undefined = 未初始化（允许 setup）；null = 文件损坏（fail-closed）；对象 = 正常
    setupNeeded: creds === undefined,
    locked: creds === null,
    username: creds ? creds.username : ''
  };
}

function validateUsername(raw) {
  const u = String(raw || '').trim();
  if (!u || u.length > 32) return null;
  if (/[\s\r\n\t\u0000-\u001f]/.test(u)) return null;
  return u;
}

function validatePassword(raw) {
  const p = String(raw || '');
  if (p.length < 8 || p.length > 128) return null;
  return p;
}

function saveCreds(username, hash) {
  writeJsonAtomic(AUTH_FILE, {
    username: username,
    hash: hash,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

function setupAccount(username, password) {
  if (!DATA_WRITABLE) {
    return { ok: false, status: 503, error: '管理员数据目录不可写，请检查容器 data 目录挂载与宿主机权限（chown 1000:1000）后重试' };
  }
  const state = getAuthState();
  if (!state.setupNeeded) {
    return { ok: false, error: '管理员账户已初始化，请直接登录' };
  }
  const u = validateUsername(username);
  if (!u) return { ok: false, error: '用户名不能为空且长度不超过 32 个字符（不含空白字符）' };
  const p = validatePassword(password);
  if (!p) return { ok: false, error: '密码长度必须在 8 ~ 128 位之间' };

  saveCreds(u, scryptHash(p));
  console.log(`[auth] 管理员账户已初始化: ${u}`);
  return { ok: true, username: u };
}

// 首次启动时从环境变量引导（幂等：仅当凭据不存在时生效一次）
function seedFromEnv() {
  ensureDataDir();
  if (getCreds() !== undefined) return;
  const u = validateUsername(process.env.ADMIN_USERNAME || 'admin') || 'admin';
  const p = process.env.ADMIN_PASSWORD || '';
  if (!p) return;
  if (!validatePassword(p)) {
    console.warn('[auth] 环境变量 ADMIN_PASSWORD 长度不足 8 位，已忽略；请通过 /api/auth/setup 初始化');
    return;
  }
  saveCreds(u, scryptHash(p));
  console.log(`[auth] 已从环境变量完成管理员账户初始化: ${u}`);
  console.log('[auth] 建议初始化成功后从环境变量中移除 ADMIN_PASSWORD 明文');
}
try {
  seedFromEnv();
} catch (e) {
  // 数据目录不可写时不阻断启动：公开接口照常服务，登录/初始化接口返回 503 提示
  warnDataDirBroken(e);
}

// ---------------------------------------------------------------------------
// 登录限流（按 IP）
// ---------------------------------------------------------------------------

const loginAttempts = new Map();

function pruneLoginAttempts() {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts.entries()) {
    if (now > rec.blockedUntil && now - rec.lastActive > 3600 * 1000) loginAttempts.delete(ip);
  }
}
setInterval(pruneLoginAttempts, 10 * 60 * 1000).unref();

function attemptLogin(ip, username, password) {
  if (!DATA_WRITABLE) {
    return {
      ok: false,
      status: 503,
      error: '管理员数据目录不可写，请检查容器 data 目录挂载与宿主机权限（chown 1000:1000）后重启'
    };
  }
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { fails: 0, blockedUntil: 0, lastActive: now };

  if (now < rec.blockedUntil) {
    return {
      ok: false,
      status: 429,
      error: '尝试次数过多，请稍后再试',
      retryAfter: Math.ceil((rec.blockedUntil - now) / 1000)
    };
  }

  const creds = getCreds();
  let success = false;
  if (creds) {
    const userOk = timingSafeEqualStr(String(username || ''), creds.username);
    const passOk = scryptVerify(String(password || ''), creds.hash);
    success = userOk && passOk;
  } else {
    // 无凭据 / 文件损坏：执行哑计算抹平时序后统一失败
    scryptVerify(String(password || ''), DUMMY_HASH);
  }

  rec.lastActive = now;
  if (!success) {
    rec.fails += 1;
    if (rec.fails >= LOGIN_FAIL_LIMIT) {
      rec.blockedUntil = now + LOGIN_BLOCK_MS;
      rec.fails = 0;
    }
    loginAttempts.set(ip, rec);
    return { ok: false, status: 401, error: '用户名或密码错误' };
  }

  loginAttempts.delete(ip);
  return { ok: true, username: creds.username };
}

// ---------------------------------------------------------------------------
// 会话管理
// ---------------------------------------------------------------------------

function parseCookies(req) {
  const header = req.headers['cookie'] || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function loadSessions() {
  const data = readJsonSafe(SESSIONS_FILE, { sessions: [] });
  return Array.isArray(data.sessions) ? data.sessions : [];
}

function saveSessions(list) {
  const now = Date.now();
  const alive = list.filter(s => s.expiresAt > now);
  if (alive.length > MAX_SESSIONS) {
    alive.sort((a, b) => (a.lastSeenAt || 0) - (b.lastSeenAt || 0));
    alive.splice(0, alive.length - MAX_SESSIONS);
  }
  try {
    writeJsonAtomic(SESSIONS_FILE, { sessions: alive });
    return true;
  } catch (e) {
    // 写盘失败（如目录只读）：内存态继续生效，权限恢复后自动恢复持久化
    return false;
  }
}

function isSecureRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const visitor = String(req.headers['cf-visitor'] || '');
  return proto === 'https' || visitor.indexOf('https') !== -1;
}

function sessionCookieHeader(req, token, maxAgeSeconds) {
  let header = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
  if (isSecureRequest(req)) header += '; Secure';
  return header;
}

function clearCookieHeader(req) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

function createSession(req, username) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const list = loadSessions();
  list.push({
    id: sha256hex(token),
    username: String(username),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ip: String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
    ua: String(req.headers['user-agent'] || '').slice(0, 200)
  });
  if (!saveSessions(list)) {
    // 会话无法持久化（数据目录只读等）：按不可用处理，避免"看似登录成功、重启即失效"
    throw new Error('SESSION_PERSIST_FAILED');
  }
  return token;
}

// 校验请求携带的会话；活跃时滑动续期（写盘节流：距上次活跃超过 1 小时才落盘）
function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || token.length !== 64) return null;

  const id = sha256hex(token);
  const list = loadSessions();
  const rec = list.find(s => s.id === id);
  if (!rec) return null;

  const now = Date.now();
  if (now > rec.expiresAt) {
    saveSessions(list.filter(s => s.id !== id));
    return null;
  }

  if (now - rec.lastSeenAt > SESSION_RENEW_GAP_MS) {
    rec.lastSeenAt = now;
    rec.expiresAt = Math.min(now + SESSION_TTL_MS, rec.createdAt + SESSION_MAX_MS);
    saveSessions(list);
  }
  return rec;
}

function revokeSessionByToken(token) {
  if (!token) return;
  const id = sha256hex(token);
  const list = loadSessions();
  saveSessions(list.filter(s => s.id !== id));
}

function revokeOtherSessions(keepToken) {
  const keepId = keepToken ? sha256hex(keepToken) : '';
  const list = loadSessions();
  const filtered = list.filter(s => s.id === keepId);
  saveSessions(filtered);
  return list.length - filtered.length;
}

// ---------------------------------------------------------------------------
// 同源校验（CSRF 防护第二道防线，配合 SameSite=Strict Cookie）
// ---------------------------------------------------------------------------

function assertSameOrigin(req) {
  const sfs = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return false;

  const origin = String(req.headers['origin'] || '');
  if (origin) {
    const host = String(req.headers['x-forwarded-host'] || req.headers['host'] || '');
    try {
      if (host && new URL(origin).host !== host) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

// 管理 API 统一鉴权入口：会话有效，且非 GET 请求必须同源
function isAuthenticated(req) {
  const session = getSession(req);
  if (!session) return false;
  if (req.method !== 'GET' && !assertSameOrigin(req)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 修改密码（校验旧密码 → 重写哈希 → 吊销其它会话 → 轮换当前会话）
// ---------------------------------------------------------------------------

function changePassword(req, currentPassword, newPassword) {
  if (!DATA_WRITABLE) {
    return { ok: false, status: 503, error: '管理员数据目录不可写，请检查容器 data 目录挂载与宿主机权限（chown 1000:1000）后重试' };
  }
  const creds = getCreds();
  if (!creds) return { ok: false, error: '管理员凭据不可用' };

  if (!scryptVerify(String(currentPassword || ''), creds.hash)) {
    return { ok: false, error: '当前密码不正确' };
  }
  const p = validatePassword(newPassword);
  if (!p) return { ok: false, error: '新密码长度必须在 8 ~ 128 位之间' };
  if (scryptVerify(p, creds.hash)) {
    return { ok: false, error: '新密码不能与当前密码相同' };
  }

  const token = parseCookies(req)[SESSION_COOKIE];
  saveCreds(creds.username, scryptHash(p));
  const revoked = revokeOtherSessions(token);

  // 会话轮换：签发新 Token，旧 Token 立即作废
  const newToken = createSession(req, creds.username);
  if (token) revokeSessionByToken(token);

  console.log(`[auth] 管理员密码已修改，吊销其它会话 ${revoked} 个`);
  return { ok: true, username: creds.username, newToken: newToken };
}

// ---------------------------------------------------------------------------
// HTTP 处理器（供 server.js 直接挂载）
// ---------------------------------------------------------------------------

function respond(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req, res, cb, limitBytes) {
  const limit = limitBytes || 16 * 1024;
  const ctype = String(req.headers['content-type'] || '');
  if (ctype.indexOf('application/json') === -1) {
    return respond(res, 415, { ok: false, error: 'Content-Type 必须为 application/json' });
  }
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > limit) req.destroy();
  });
  req.on('error', () => {});
  req.on('end', () => {
    let data;
    try {
      data = JSON.parse(body || '{}');
    } catch (e) {
      return respond(res, 400, { ok: false, error: '请求格式错误' });
    }
    cb(data);
  });
}

function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  const xr = req.headers['x-real-ip'];
  if (xr) return String(xr).trim();
  return req.socket.remoteAddress || 'unknown';
}

// GET /api/auth/status
function handleStatus(req, res) {
  const state = getAuthState();
  const session = getSession(req);
  return respond(res, 200, {
    ok: true,
    authed: Boolean(session),
    setupNeeded: state.setupNeeded,
    dataWritable: DATA_WRITABLE,
    username: session ? state.username : ''
  });
}

// POST /api/auth/setup — 仅首次初始化可用
function handleSetup(req, res) {
  if (!assertSameOrigin(req)) return respond(res, 403, { ok: false, error: '拒绝跨站请求' });
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = setupAccount(data.username, data.password);
    } catch (e) {
      // 数据目录不可写时绝不崩进程：返回 503 提示，公开接口继续可用
      return respond(res, 503, { ok: false, error: '管理员数据目录不可写，请检查容器 data 目录挂载与宿主机权限（chown 1000:1000）后重试' });
    }
    if (!result.ok) return respond(res, result.status || 400, result);

    let token;
    try {
      token = createSession(req, result.username);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '会话写入失败，请检查 data 目录权限后重试' });
    }
    res.setHeader('Set-Cookie', sessionCookieHeader(req, token, Math.floor(SESSION_TTL_MS / 1000)));
    return respond(res, 200, { ok: true, username: result.username });
  });
}

// POST /api/auth/login
function handleLogin(req, res) {
  if (!assertSameOrigin(req)) return respond(res, 403, { ok: false, error: '拒绝跨站请求' });
  return readJsonBody(req, res, (data) => {
    const ip = getClientIp(req);
    const result = attemptLogin(ip, data.username, data.password);
    if (!result.ok) {
      res.setHeader('Retry-After', String(result.retryAfter || 60));
      return respond(res, result.status, { ok: false, error: result.error });
    }

    let token;
    try {
      token = createSession(req, result.username);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '会话写入失败，请检查 data 目录权限后重试' });
    }
    res.setHeader('Set-Cookie', sessionCookieHeader(req, token, Math.floor(SESSION_TTL_MS / 1000)));
    return respond(res, 200, { ok: true, username: result.username });
  });
}

// POST /api/auth/logout
function handleLogout(req, res) {
  if (!assertSameOrigin(req)) return respond(res, 403, { ok: false, error: '拒绝跨站请求' });
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    try {
      revokeSessionByToken(token);
    } catch (e) {
      // 会话文件写不进去也照样清除 Cookie：登出对客户端必须成功
    }
  }
  res.setHeader('Set-Cookie', clearCookieHeader(req));
  return respond(res, 200, { ok: true });
}

// POST /api/auth/change-password
function handleChangePassword(req, res) {
  if (!assertSameOrigin(req)) return respond(res, 403, { ok: false, error: '拒绝跨站请求' });
  if (!getSession(req)) return respond(res, 401, { ok: false, error: '登录状态已失效，请重新登录' });
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = changePassword(req, data.currentPassword, data.newPassword);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    if (!result.ok) return respond(res, result.status || 400, result);

    res.setHeader('Set-Cookie', sessionCookieHeader(req, result.newToken, Math.floor(SESSION_TTL_MS / 1000)));
    return respond(res, 200, { ok: true, username: result.username });
  });
}

// 定期清理过期会话文件
setInterval(() => {
  try {
    const list = loadSessions();
    const now = Date.now();
    if (list.some(s => s.expiresAt <= now)) saveSessions(list);
  } catch (e) {}
}, 60 * 60 * 1000).unref();

module.exports = {
  SESSION_COOKIE,
  getAuthState,
  getSession,
  isAuthenticated,
  assertSameOrigin,
  changePassword,
  handleStatus,
  handleSetup,
  handleLogin,
  handleLogout,
  handleChangePassword
};

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
const totp = require('./totp');
const webauthn = require('./webauthn');
const site = require('./site');

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

function normalizeTotp(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: Boolean(t.enabled),
    secret: String(t.secret || ''),
    pending: String(t.pending || ''),
    pendingAt: Number(t.pendingAt) || 0,
    backup: Array.isArray(t.backup) ? t.backup.filter(x => typeof x === 'string') : []
  };
}

function getCreds() {
  // 凭据文件存在但损坏 → 返回 null 但 setupNeeded 也为 false（fail-closed，拒绝一切登录）
  if (fs.existsSync(AUTH_FILE)) {
    const raw = readJsonSafe(AUTH_FILE, null);
    if (raw && raw.username && raw.hash) {
      return {
        username: String(raw.username),
        hash: String(raw.hash),
        createdAt: raw.createdAt || 0,
        updatedAt: raw.updatedAt || 0,
        totp: normalizeTotp(raw.totp),
        passkeys: Array.isArray(raw.passkeys) ? raw.passkeys.filter(k => k && k.id && k.coseRaw) : []
      };
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

function saveAuthRecord(record) {
  const prev = readJsonSafe(AUTH_FILE, {}) || {};
  writeJsonAtomic(AUTH_FILE, {
    username: record.username,
    hash: record.hash,
    createdAt: prev.createdAt || record.createdAt || Date.now(),
    updatedAt: Date.now(),
    totp: normalizeTotp(record.totp),
    passkeys: Array.isArray(record.passkeys) ? record.passkeys : []
  });
}

function saveCreds(username, hash) {
  saveAuthRecord({ username, hash, totp: { enabled: false }, passkeys: [] });
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

function registerFailure(ip, rec, now) {
  rec.lastActive = now;
  rec.fails += 1;
  if (rec.fails >= LOGIN_FAIL_LIMIT) {
    rec.blockedUntil = now + LOGIN_BLOCK_MS;
    rec.fails = 0;
  }
  loginAttempts.set(ip, rec);
}

/**
 * 账密登录，支持两步验证：
 *  - 未开启 2FA：行为与之前一致
 *  - 已开启 2FA 且未带验证码：返回 needTotp，密码正确但还差一步
 *  - 验证码可以是 6 位动态码，也可以是一次性备用码（命中后立即作废）
 */
function attemptLogin(ip, username, password, totpCode, ua) {
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

  if (!success) {
    registerFailure(ip, rec, now);
    return { ok: false, status: 401, error: '用户名或密码错误' };
  }

  // 密码正确之后再看黑名单：避免用报错差异去探测哪些 IP / 设备被封
  if (isBlocked(ip, ua || '')) {
    return { ok: false, status: 403, error: '该设备或 IP 已被禁止登录，请在「管理 · 登录会话」中解除' };
  }

  const mfa = creds.totp;
  if (mfa && mfa.enabled) {
    const code = String(totpCode || '').trim();
    if (!code) {
      rec.lastActive = now;
      loginAttempts.set(ip, rec);
      return { ok: false, status: 401, needTotp: true, error: '请输入两步验证码' };
    }
    let pass = false;
    let usedBackupIdx = -1;
    if (/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
      pass = totp.verifyTotp(mfa.secret, code);
    }
    if (!pass) {
      usedBackupIdx = totp.matchBackupCode(code, mfa.backup);
      pass = usedBackupIdx >= 0;
    }
    if (!pass) {
      registerFailure(ip, rec, now);
      return { ok: false, status: 401, needTotp: true, error: '两步验证码不正确' };
    }
    if (usedBackupIdx >= 0) {
      mfa.backup.splice(usedBackupIdx, 1);
      saveAuthRecord({ ...creds, totp: mfa });
      console.log(`[auth] 已使用一次性备用码登录，剩余备用码 ${mfa.backup.length} 个`);
    }
  }

  loginAttempts.delete(ip);
  return { ok: true, username: creds.username, totpUsed: Boolean(mfa && mfa.enabled) };
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

// ---------------- 会话存储（在线会话 + 历史会话 + 登录黑名单） ----------------

const SESSION_HISTORY_MAX = 80;          // 历史会话最多保留条数
const ONLINE_WINDOW_MS = 3 * 60 * 1000;  // 最近 3 分钟有请求视为「在线」
const BLOCK_MAX = 200;                   // 黑名单条数上限

// 每次请求都会刷新这里的最后活跃时间；持久化仍按 SESSION_RENEW_GAP_MS 节流
const lastSeenMem = new Map();

function loadStore() {
  const data = readJsonSafe(SESSIONS_FILE, {});
  return {
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    history: Array.isArray(data.history) ? data.history : [],
    blocked: Array.isArray(data.blocked) ? data.blocked : []
  };
}

function saveStore(store) {
  const now = Date.now();
  const alive = (store.sessions || []).filter(s => s.expiresAt > now);
  if (alive.length > MAX_SESSIONS) {
    alive.sort((a, b) => (a.lastSeenAt || 0) - (b.lastSeenAt || 0));
    alive.splice(0, alive.length - MAX_SESSIONS);
  }
  const history = (store.history || []).slice(-SESSION_HISTORY_MAX);
  const blocked = (store.blocked || []).slice(-BLOCK_MAX);
  try {
    writeJsonAtomic(SESSIONS_FILE, { sessions: alive, history, blocked });
    return true;
  } catch (e) {
    // 写盘失败（如目录只读）：内存态继续生效，权限恢复后自动恢复持久化
    return false;
  }
}

// 兼容旧调用点：只读写「在线会话」部分
function loadSessions() {
  return loadStore().sessions;
}

function saveSessions(list) {
  const store = loadStore();
  store.sessions = list;
  return saveStore(store);
}

/** 把一条会话移入历史记录（保留踢下线 / 退出 / 过期原因） */
function archiveSession(store, rec, reason) {
  if (!rec) return;
  store.history = store.history || [];
  if (store.history.some(h => h.id === rec.id)) return;
  const seen = Math.max(rec.lastSeenAt || 0, lastSeenMem.get(rec.id) || 0);
  store.history.push({
    id: rec.id,
    username: rec.username || '',
    ip: rec.ip || '',
    ua: rec.ua || '',
    label: rec.label || '',
    createdAt: rec.createdAt || 0,
    lastSeenAt: seen,
    endedAt: Date.now(),
    reason: reason || 'expired'
  });
  lastSeenMem.delete(rec.id);
}

// ---------------- 设备识别 ----------------

function parseDevice(uaRaw) {
  const ua = String(uaRaw || '');
  let type = 'desktop';
  let typeLabel = '桌面设备';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) { type = 'tablet'; typeLabel = '平板'; }
  else if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) { type = 'mobile'; typeLabel = '手机'; }

  let os = '未知系统';
  const android = /Android\s([0-9.]+)/.exec(ua);
  if (/Windows NT 10\.0/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS ' + ((/OS (\d+)[_.](\d+)/.exec(ua) || []).slice(1).join('.') || '').replace(/\.$/, '');
  else if (android) os = 'Android ' + android[1];
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = '未知客户端';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/MicroMessenger/.test(ua)) browser = '微信';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/curl\//.test(ua)) browser = 'curl';
  else if (/Wget|python-requests|Go-http-client|okhttp/i.test(ua)) browser = '脚本客户端';

  let model = '';
  const iphone = /iPhone/.test(ua) ? 'iPhone' : '';
  if (iphone) model = iphone;
  else if (/iPad/.test(ua)) model = 'iPad';
  else {
    const m = /Android[^;]*;\s*([^;)]+)\s*(?:Build|\))/.exec(ua);
    if (m) model = m[1].replace(/\s*Build.*/i, '').trim().slice(0, 40);
  }
  return { type, typeLabel, os, browser, model, label: browser + ' · ' + os };
}

function deviceKey(uaRaw) {
  return sha256hex('ua:' + String(uaRaw || '').slice(0, 200));
}

// ---------------- IP 归属地（带内存缓存，失败静默） ----------------

const geoCache = new Map();

function isPrivateIp(ip) {
  const v = String(ip || '');
  if (!v) return true;
  if (v === '::1' || /^127\./.test(v) || /^10\./.test(v) || /^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (/^169\.254\./.test(v) || /^fc|^fd/i.test(v)) return true;
  return false;
}

function lookupGeo(ip) {
  return new Promise((resolve) => {
    const key = String(ip || '');
    if (!key) return resolve({ ok: false, error: '缺少 IP' });
    if (isPrivateIp(key)) return resolve({ ok: true, local: true, label: '内网 / 本机地址' });
    if (geoCache.has(key)) return resolve(geoCache.get(key));
    const target = 'http://ip-api.com/json/' + encodeURIComponent(key) + '?lang=zh-CN&fields=status,country,regionName,city,isp,org,as';
    let timer = null;
    const req = require('http').get(target, { timeout: 4000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; if (body.length > 8192) req.destroy(); });
      res.on('end', () => {
        if (timer) clearTimeout(timer);
        let out = { ok: false, error: '归属地查询失败' };
        try {
          const data = JSON.parse(body);
          if (data && data.status === 'success') {
            const parts = [data.country, data.regionName, data.city].filter(Boolean);
            out = { ok: true, country: data.country || '', region: data.regionName || '', city: data.city || '', isp: data.isp || '', org: data.org || '', label: parts.join(' ') || '未知' };
            geoCache.set(key, out);
          } else if (data && data.message) {
            out = { ok: false, error: String(data.message) };
          }
        } catch (e) { /* 解析失败保持默认 */ }
        resolve(out);
      });
    });
    req.on('error', () => { if (timer) clearTimeout(timer); resolve({ ok: false, error: '归属地服务不可达' }); });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '归属地查询超时' }); });
  });
}

// ---------------- 黑名单 ----------------

function listBlocked() {
  return loadStore().blocked.map(b => ({
    type: b.type,
    value: b.type === 'ip' ? b.value : String(b.value).slice(0, 16),
    note: b.note || '',
    createdAt: b.createdAt || 0
  }));
}

function isBlocked(ip, ua) {
  const list = loadStore().blocked;
  if (!list.length) return false;
  const uaKey = deviceKey(ua);
  return list.some(b => (b.type === 'ip' && b.value === ip) || (b.type === 'device' && b.value === uaKey));
}

function addBlock(type, value, note) {
  if (type !== 'ip' && type !== 'device') return { ok: false, error: '类型不合法' };
  const v = String(value || '').trim();
  if (!v) return { ok: false, error: '缺少要封禁的目标' };
  const store = loadStore();
  if (!store.blocked.some(b => b.type === type && b.value === v)) {
    store.blocked.push({ type, value: v, note: String(note || '').slice(0, 60), createdAt: Date.now() });
  }
  const ok = saveStore(store);
  if (!ok) return { ok: false, status: 503, error: '写入失败，请检查 data 目录权限' };
  return { ok: true, blocked: listBlocked() };
}

function removeBlock(type, value) {
  const store = loadStore();
  const before = store.blocked.length;
  store.blocked = store.blocked.filter(b => !(b.type === type && String(b.value).startsWith(String(value))));
  if (store.blocked.length === before) return { ok: false, error: '没有找到对应记录' };
  saveStore(store);
  return { ok: true, blocked: listBlocked() };
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
    ua: String(req.headers['user-agent'] || '').slice(0, 200),
    label: ''
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
  const store = loadStore();
  const rec = store.sessions.find(s => s.id === id);
  if (!rec) return null;

  const now = Date.now();
  if (now > rec.expiresAt) {
    archiveSession(store, rec, 'expired');
    store.sessions = store.sessions.filter(item => item.id !== id);
    saveStore(store);
    return null;
  }

  // 内存里记下最新活跃时间，用于「在线 / 离线」判断（落盘仍按节流间隔）
  lastSeenMem.set(id, now);
  const list = store.sessions;

  if (now - rec.lastSeenAt > SESSION_RENEW_GAP_MS) {
    rec.lastSeenAt = now;
    rec.expiresAt = Math.min(now + SESSION_TTL_MS, rec.createdAt + SESSION_MAX_MS);
    saveSessions(list);
  }
  return rec;
}

function revokeSessionByToken(token, reason) {
  if (!token) return;
  const id = sha256hex(token);
  const store = loadStore();
  const rec = store.sessions.find(s => s.id === id);
  if (rec) archiveSession(store, rec, reason || 'logout');
  store.sessions = store.sessions.filter(s => s.id !== id);
  saveStore(store);
}

function revokeOtherSessions(keepToken, reason) {
  const keepId = keepToken ? sha256hex(keepToken) : '';
  const store = loadStore();
  store.sessions.forEach(s => { if (s.id !== keepId) archiveSession(store, s, reason || 'kicked'); });
  const filtered = store.sessions.filter(s => s.id === keepId);
  const removed = store.sessions.length - filtered.length;
  store.sessions = filtered;
  saveStore(store);
  return removed;
}

/** 按会话 id 踢下线（不能踢当前会话，避免把自己锁在外面） */
function revokeSessionById(req, id) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const currentId = token ? sha256hex(token) : '';
  const target = String(id || '');
  if (!target) return { ok: false, error: '缺少会话 id' };
  const store = loadStore();
  const rec = store.sessions.find(s => s.id === target || s.id.indexOf(target) === 0);
  if (!rec) return { ok: false, error: '会话不存在或已失效' };
  if (rec.id === currentId) return { ok: false, error: '不能下线当前正在使用的会话' };
  archiveSession(store, rec, 'kicked');
  store.sessions = store.sessions.filter(s => s.id !== rec.id);
  if (!saveStore(store)) return { ok: false, status: 503, error: '写入失败，请检查 data 目录权限' };
  return { ok: true };
}

/** 给在线会话或历史会话改备注名 */
function renameSession(id, label, includeHistory) {
  const target = String(id || '');
  const name = String(label || '').trim().slice(0, 24);
  if (!target) return { ok: false, error: '缺少会话 id' };
  const store = loadStore();
  const hit = store.sessions.find(s => s.id === target || s.id.indexOf(target) === 0);
  if (hit) {
    hit.label = name;
  } else if (includeHistory) {
    const past = store.history.find(h => h.id === target || h.id.indexOf(target) === 0);
    if (!past) return { ok: false, error: '会话不存在' };
    past.label = name;
  } else {
    return { ok: false, error: '会话不存在' };
  }
  if (!saveStore(store)) return { ok: false, status: 503, error: '写入失败，请检查 data 目录权限' };
  return { ok: true, label: name };
}

/** 把某条会话的 IP / 设备加入黑名单 */
function blockSession(id, scope, note) {
  const target = String(id || '');
  const store = loadStore();
  const rec = store.sessions.find(s => s.id === target || s.id.indexOf(target) === 0)
    || store.history.find(h => h.id === target || h.id.indexOf(target) === 0);
  if (!rec) return { ok: false, error: '会话不存在' };
  const full = loadStore();
  let added = 0;
  const push = (type, value) => {
    if (!value) return;
    if (!full.blocked.some(b => b.type === type && b.value === value)) {
      full.blocked.push({ type, value, note: String(note || '').slice(0, 60), createdAt: Date.now() });
      added += 1;
    }
  };
  if (scope === 'ip' || scope === 'both') push('ip', rec.ip);
  if (scope === 'device' || scope === 'both') push('device', deviceKey(rec.ua));
  if (!added) return { ok: false, error: '该 IP / 设备已在黑名单中' };
  if (!saveStore(full)) return { ok: false, status: 503, error: '写入失败，请检查 data 目录权限' };
  return { ok: true, added };
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
  saveAuthRecord({
    username: creds.username,
    hash: scryptHash(p),
    createdAt: creds.createdAt,
    totp: creds.totp,
    passkeys: creds.passkeys
  });
  const revoked = revokeOtherSessions(token, '密码已修改');

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
    const result = attemptLogin(ip, data.username, data.password, data.totpCode || data.code, String(req.headers['user-agent'] || ''));
    if (!result.ok) {
      if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
      const payload = { ok: false, error: result.error };
      if (result.needTotp) payload.needTotp = true;
      return respond(res, result.status, payload);
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


// ---------------------------------------------------------------------------
// 账号管理：改用户名 / 两步验证 / 通行密钥 / 会话
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challenges = new Map();

function putChallenge(type, extra) {
  const challenge = webauthn.b64uEncode(crypto.randomBytes(32));
  challenges.set(challenge, { type, expiresAt: Date.now() + CHALLENGE_TTL_MS, ...(extra || {}) });
  return challenge;
}

function takeChallenge(challenge, type) {
  const rec = challenges.get(String(challenge || ''));
  if (!rec) return null;
  challenges.delete(challenge);
  if (rec.type !== type || rec.expiresAt < Date.now()) return null;
  return rec;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of challenges.entries()) if (v.expiresAt < now) challenges.delete(k);
}, 10 * 60 * 1000).unref();

function rpConfig(req) {
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers['host'] || '').split(',')[0].trim();
  const hostname = hostHeader.split(':')[0] || 'localhost';
  const rpId = String(process.env.WEBAUTHN_RP_ID || hostname).trim();
  const proto = isSecureRequest(req) ? 'https' : 'http';
  const origins = [];
  if (process.env.WEBAUTHN_ORIGIN) {
    origins.push(String(process.env.WEBAUTHN_ORIGIN).replace(/\/+$/, ''));
  } else {
    origins.push(`${proto}://${hostHeader || hostname}`);
  }
  if (process.env.WEBAUTHN_EXTRA_ORIGINS) {
    String(process.env.WEBAUTHN_EXTRA_ORIGINS).split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean).forEach(o => origins.push(o));
  }
  return { rpId, origins };
}

function requireWritable() {
  if (!DATA_WRITABLE) {
    return { ok: false, status: 503, error: '管理员数据目录不可写，请检查容器 data 目录挂载与宿主机权限（chown 1000:1000）后重试' };
  }
  return null;
}

function verifyPasswordOrFail(creds, password) {
  if (!creds) return '管理员凭据不可用';
  if (!scryptVerify(String(password || ''), creds.hash)) return '当前密码不正确';
  return '';
}

function changeUsername(currentPassword, newUsername) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  const err = verifyPasswordOrFail(creds, currentPassword);
  if (err) return { ok: false, error: err };

  const u = validateUsername(newUsername);
  if (!u) return { ok: false, error: '用户名不能为空且长度不超过 32 个字符（不含空白字符）' };
  if (timingSafeEqualStr(u, creds.username)) return { ok: false, error: '新用户名与当前用户名相同' };

  saveAuthRecord({ ...creds, username: u });
  // 会话里冗余存了用户名，同步刷新，避免界面显示旧名字
  const list = loadSessions();
  let changed = 0;
  list.forEach(sess => {
    if (sess.username !== u) { sess.username = u; changed += 1; }
  });
  if (changed) saveSessions(list);
  console.log(`[auth] 管理员用户名已修改: ${creds.username} -> ${u}`);
  return { ok: true, username: u };
}

function beginTotpSetup(currentPassword) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  const err = verifyPasswordOrFail(creds, currentPassword);
  if (err) return { ok: false, error: err };
  if (creds.totp.enabled) return { ok: false, error: '两步验证已开启，如需重设请先关闭' };

  const secret = totp.generateSecret();
  saveAuthRecord({ ...creds, totp: { ...creds.totp, pending: secret, pendingAt: Date.now() } });
  const issuer = site.getSite().name || 'Blog Console';
  return {
    ok: true,
    secret,
    otpauth: totp.otpauthUrl(secret, creds.username, issuer),
    issuer,
    account: creds.username
  };
}

function enableTotp(code) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  if (!creds) return { ok: false, error: '管理员凭据不可用' };
  if (creds.totp.enabled) return { ok: false, error: '两步验证已开启' };
  if (!creds.totp.pending) return { ok: false, error: '请先生成两步验证密钥' };
  if (Date.now() - creds.totp.pendingAt > 15 * 60 * 1000) {
    return { ok: false, error: '密钥已过期，请重新生成' };
  }
  if (!totp.verifyTotp(creds.totp.pending, code)) {
    return { ok: false, error: '验证码不正确，请确认设备时间是否准确' };
  }

  const { plain, hashed } = totp.generateBackupCodes(10);
  saveAuthRecord({
    ...creds,
    totp: { enabled: true, secret: creds.totp.pending, pending: '', pendingAt: 0, backup: hashed }
  });
  console.log('[auth] 已开启两步验证（TOTP）');
  return { ok: true, backupCodes: plain };
}

function disableTotp(currentPassword) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  const err = verifyPasswordOrFail(creds, currentPassword);
  if (err) return { ok: false, error: err };
  if (!creds.totp.enabled && !creds.totp.pending) return { ok: false, error: '两步验证未开启' };

  saveAuthRecord({ ...creds, totp: { enabled: false, secret: '', pending: '', pendingAt: 0, backup: [] } });
  console.log('[auth] 已关闭两步验证');
  return { ok: true };
}

function regenerateBackupCodes(currentPassword) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  const err = verifyPasswordOrFail(creds, currentPassword);
  if (err) return { ok: false, error: err };
  if (!creds.totp.enabled) return { ok: false, error: '两步验证未开启' };

  const { plain, hashed } = totp.generateBackupCodes(10);
  saveAuthRecord({ ...creds, totp: { ...creds.totp, backup: hashed } });
  console.log('[auth] 已重新生成一次性备用码');
  return { ok: true, backupCodes: plain };
}

// ---------------- 通行密钥（Passkey / WebAuthn） ----------------

function publicPasskeyMeta(k) {
  return {
    id: k.id,
    label: k.label || '通行密钥',
    createdAt: k.createdAt || 0,
    lastUsedAt: k.lastUsedAt || 0,
    counter: k.counter || 0
  };
}

function listPasskeys() {
  const creds = getCreds();
  return creds && creds.passkeys ? creds.passkeys.map(publicPasskeyMeta) : [];
}

function beginPasskeyRegistration(req) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  if (!creds) return { ok: false, error: '管理员凭据不可用' };

  const { rpId } = rpConfig(req);
  const challenge = putChallenge('register', { rpId });
  const siteName = site.getSite().name || 'Blog Console';
  return {
    ok: true,
    publicKey: {
      challenge,
      rp: { id: rpId, name: siteName },
      user: {
        id: webauthn.b64uEncode(Buffer.from(creds.username, 'utf8')),
        name: creds.username,
        displayName: creds.username
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        requireResidentKey: false,
        userVerification: 'preferred'
      },
      excludeCredentials: creds.passkeys.map(k => ({ type: 'public-key', id: k.id }))
    }
  };
}

function finishPasskeyRegistration(req, body) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  if (!creds) return { ok: false, error: '管理员凭据不可用' };

  let result;
  try {
    const rp = rpConfig(req);
    const clientData = JSON.parse(webauthn.b64uDecode(body.clientDataJSON).toString('utf8'));
    const challenge = takeChallenge(clientData.challenge, 'register');
    if (!challenge) return { ok: false, error: '注册会话已过期，请重新开始' };
    result = webauthn.verifyRegistration({
      clientDataJSON: body.clientDataJSON,
      attestationObject: body.attestationObject,
      expectedChallenge: clientData.challenge,
      rpId: rp.rpId,
      expectedOrigins: rp.origins
    });
  } catch (e) {
    return { ok: false, error: '通行密钥注册失败：' + (e && e.message ? e.message : '校验未通过') };
  }

  if (creds.passkeys.some(k => k.id === result.credentialId)) {
    return { ok: false, error: '该通行密钥已存在' };
  }
  const label = String(body.label || '').trim().slice(0, 40) || ('通行密钥 ' + new Date().toLocaleDateString('zh-CN'));
  const record = {
    id: result.credentialId,
    coseRaw: result.coseRaw,
    alg: result.alg,
    counter: result.counter || 0,
    label,
    createdAt: Date.now(),
    lastUsedAt: 0,
    transports: Array.isArray(body.transports) ? body.transports.slice(0, 4) : []
  };
  creds.passkeys.push(record);
  saveAuthRecord(creds);
  console.log(`[auth] 已添加通行密钥：${label}`);
  return { ok: true, passkey: publicPasskeyMeta(record) };
}

function deletePasskey(currentPassword, id) {
  const blocked = requireWritable();
  if (blocked) return blocked;
  const creds = getCreds();
  const err = verifyPasswordOrFail(creds, currentPassword);
  if (err) return { ok: false, error: err };

  const idx = creds.passkeys.findIndex(k => k.id === String(id || ''));
  if (idx === -1) return { ok: false, error: '未找到该通行密钥' };
  const [removed] = creds.passkeys.splice(idx, 1);
  saveAuthRecord(creds);
  console.log(`[auth] 已删除通行密钥：${removed.label || removed.id}`);
  return { ok: true };
}

function beginPasskeyLogin(req) {
  const creds = getCreds();
  if (!creds || !creds.passkeys.length) return { ok: false, status: 400, error: '尚未登记通行密钥' };

  const { rpId } = rpConfig(req);
  const challenge = putChallenge('login', { rpId });
  return {
    ok: true,
    publicKey: {
      challenge,
      rpId,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: creds.passkeys.map(k => ({
        type: 'public-key',
        id: k.id,
        transports: Array.isArray(k.transports) && k.transports.length ? k.transports : undefined
      }))
    }
  };
}

function finishPasskeyLogin(req, body, ip) {
  const creds = getCreds();
  if (!creds) return { ok: false, status: 401, error: '管理员凭据不可用' };

  const now = Date.now();
  const rec = loginAttempts.get(ip) || { fails: 0, blockedUntil: 0, lastActive: now };
  if (now < rec.blockedUntil) {
    return { ok: false, status: 429, error: '尝试次数过多，请稍后再试', retryAfter: Math.ceil((rec.blockedUntil - now) / 1000) };
  }

  try {
    const clientData = JSON.parse(webauthn.b64uDecode(body.clientDataJSON).toString('utf8'));
    const challenge = takeChallenge(clientData.challenge, 'login');
    if (!challenge) return { ok: false, status: 401, error: '登录会话已过期，请重试' };

    const credentialId = String(body.credentialId || '');
    const idx = creds.passkeys.findIndex(k => k.id === credentialId);
    if (idx === -1) return { ok: false, status: 401, error: '该通行密钥未登记' };

    const rp = rpConfig(req);
    const result = webauthn.verifyAssertion({
      clientDataJSON: body.clientDataJSON,
      authenticatorData: body.authenticatorData,
      signature: body.signature,
      expectedChallenge: clientData.challenge,
      rpId: rp.rpId,
      expectedOrigins: rp.origins,
      coseRaw: creds.passkeys[idx].coseRaw,
      storedCounter: creds.passkeys[idx].counter
    });

    creds.passkeys[idx].counter = result.counter || creds.passkeys[idx].counter;
    creds.passkeys[idx].lastUsedAt = Date.now();
    saveAuthRecord(creds);
    loginAttempts.delete(ip);
    return { ok: true, username: creds.username };
  } catch (e) {
    registerFailure(ip, rec, now);
    return { ok: false, status: 401, error: '通行密钥验证失败：' + (e && e.message ? e.message : '校验未通过') };
  }
}

// ---------------- 会话列表 ----------------

function sessionView(rec, currentId, now, ended) {
  const seenRaw = Math.max(rec.lastSeenAt || 0, ended ? 0 : (lastSeenMem.get(rec.id) || 0));
  const device = parseDevice(rec.ua);
  const expired = !ended && rec.expiresAt <= now;
  const online = !ended && !expired && (now - seenRaw) < ONLINE_WINDOW_MS;
  return {
    id: String(rec.id || ''),
    short: String(rec.id || '').slice(0, 8),
    current: rec.id === currentId,
    status: ended ? 'ended' : (online ? 'online' : (expired ? 'expired' : 'offline')),
    label: rec.label || '',
    ip: rec.ip || '',
    ua: rec.ua || '',
    device,
    createdAt: rec.createdAt || 0,
    lastSeenAt: seenRaw,
    endedAt: rec.endedAt || 0,
    reason: rec.reason || '',
    expiresAt: rec.expiresAt || 0,
    durationMs: Math.max(0, (ended ? (rec.endedAt || seenRaw) : now) - (rec.createdAt || 0))
  };
}

/** 在线会话（按最近活跃倒序） */
function listSessions(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const currentId = token ? sha256hex(token) : '';
  const now = Date.now();
  return loadStore().sessions
    .filter(s => s.expiresAt > now)
    .sort((a, b) => (Math.max(b.lastSeenAt || 0, lastSeenMem.get(b.id) || 0)) - (Math.max(a.lastSeenAt || 0, lastSeenMem.get(a.id) || 0)))
    .map(s => sessionView(s, currentId, now, false));
}

// 会话管理页要用的完整数据：在线 / 历史 / 黑名单
function sessionOverview(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const currentId = token ? sha256hex(token) : '';
  const now = Date.now();
  const store = loadStore();
  const active = store.sessions
    .filter(s => s.expiresAt > now)
    .sort((a, b) => (Math.max(b.lastSeenAt || 0, lastSeenMem.get(b.id) || 0)) - (Math.max(a.lastSeenAt || 0, lastSeenMem.get(a.id) || 0)))
    .map(s => sessionView(s, currentId, now, false));
  const history = store.history
    .slice()
    .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
    .slice(0, 40)
    .map(h => sessionView(h, currentId, now, true));
  return { sessions: active, history, blocked: listBlocked() };
}

/** 清理过期会话并归档（每 30 分钟） */
setInterval(() => {
  const now = Date.now();
  const store = loadStore();
  const expired = store.sessions.filter(s => s.expiresAt <= now);
  if (!expired.length) return;
  expired.forEach(s => archiveSession(store, s, 'expired'));
  store.sessions = store.sessions.filter(s => s.expiresAt > now);
  saveStore(store);
}, 30 * 60 * 1000).unref();

function adminOverview(req) {
  const creds = getCreds();
  const sessionData = sessionOverview(req);
  return {
    username: creds ? creds.username : '',
    site: site.getSite(),
    totp: {
      enabled: Boolean(creds && creds.totp.enabled),
      pending: Boolean(creds && creds.totp.pending && !creds.totp.enabled),
      backupCodesLeft: creds && creds.totp.enabled ? creds.totp.backup.length : 0
    },
    passkeys: listPasskeys(),
    sessions: sessionData.sessions,
    history: sessionData.history,
    blocked: sessionData.blocked,
    dataWritable: DATA_WRITABLE,
    version: (() => {
      try { return require('../package.json').version || '1.0.0'; } catch (e) { return '1.0.0'; }
    })()
  };
}

// ---------------------------------------------------------------------------
// 管理接口 HTTP 处理器
// ---------------------------------------------------------------------------

function handleSiteGet(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return respond(res, 200, { ok: true, site: site.getSite() });
}

function handleAdminOverview(req, res) {
  return respond(res, 200, { ok: true, ...adminOverview(req) });
}

function handleSiteSave(req, res) {
  return readJsonBody(req, res, (data) => {
    try {
      const saved = site.saveSite(data || {});
      return respond(res, 200, { ok: true, site: saved });
    } catch (e) {
      return respond(res, 503, { ok: false, error: '站点配置写入失败，请检查 data 目录权限' });
    }
  });
}

function handleChangeUsername(req, res) {
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = changeUsername(data.currentPassword || data.password, data.username);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    if (!result.ok) return respond(res, result.status || 400, result);
    return respond(res, 200, { ok: true, username: result.username });
  });
}

function handleTotpSetup(req, res) {
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = beginTotpSetup(data.currentPassword || data.password);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handleTotpEnable(req, res) {
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = enableTotp(data.code);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handleTotpDisable(req, res) {
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = disableTotp(data.currentPassword || data.password);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handleBackupCodes(req, res) {
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = regenerateBackupCodes(data.currentPassword || data.password);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handlePasskeyRegisterOptions(req, res) {
  return readJsonBody(req, res, () => {
    let result;
    try {
      result = beginPasskeyRegistration(req);
    } catch (e) {
      return respond(res, 500, { ok: false, error: '生成注册参数失败' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handlePasskeyRegister(req, res) {
  return readJsonBody(req, res, (raw) => {
    // WebAuthn 响应比普通 JSON 大，单独放宽上限
    let result;
    try {
      result = finishPasskeyRegistration(req, raw);
    } catch (e) {
      return respond(res, 500, { ok: false, error: '通行密钥注册失败' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  }, 64 * 1024);
}

function handlePasskeyList(req, res) {
  const creds = getCreds();
  return respond(res, 200, {
    ok: true,
    passkeys: listPasskeys(),
    totpEnabled: Boolean(creds && creds.totp.enabled)
  });
}

function handlePasskeyDelete(req, res) {
  return readJsonBody(req, res, (data) => {
    let result;
    try {
      result = deletePasskey(data.currentPassword || data.password, data.id);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handlePasskeyLoginOptions(req, res) {
  if (!assertSameOrigin(req)) return respond(res, 403, { ok: false, error: '拒绝跨站请求' });
  return readJsonBody(req, res, () => {
    const result = beginPasskeyLogin(req);
    return respond(res, result.ok ? 200 : (result.status || 400), result);
  });
}

function handlePasskeyLogin(req, res) {
  if (!assertSameOrigin(req)) return respond(res, 403, { ok: false, error: '拒绝跨站请求' });
  return readJsonBody(req, res, (data) => {
    const result = finishPasskeyLogin(req, data || {}, getClientIp(req));
    if (!result.ok) {
      if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
      return respond(res, result.status || 401, { ok: false, error: result.error });
    }
    let token;
    try {
      token = createSession(req, result.username);
    } catch (e) {
      return respond(res, 503, { ok: false, error: '会话写入失败，请检查 data 目录权限后重试' });
    }
    res.setHeader('Set-Cookie', sessionCookieHeader(req, token, Math.floor(SESSION_TTL_MS / 1000)));
    return respond(res, 200, { ok: true, username: result.username });
  }, 64 * 1024);
}

function handleSessionsList(req, res) {
  return respond(res, 200, Object.assign({ ok: true }, sessionOverview(req)));
}

function handleSessionsRevokeOthers(req, res) {
  return readJsonBody(req, res, () => {
    let revoked = 0;
    try {
      revoked = revokeOtherSessions(parseCookies(req)[SESSION_COOKIE], '批量下线');
    } catch (e) {
      return respond(res, 503, { ok: false, error: '数据写入失败，请检查 data 目录权限后重试' });
    }
    return respond(res, 200, { ok: true, revoked });
  });
}

// POST /api/auth/sessions/revoke  { id }
function handleSessionRevoke(req, res) {
  return readJsonBody(req, res, (data) => {
    const result = revokeSessionById(req, data.id);
    if (!result.ok) return respond(res, result.status || 400, { ok: false, error: result.error });
    return respond(res, 200, Object.assign({ ok: true }, sessionOverview(req)));
  }, 8 * 1024);
}

// POST /api/auth/sessions/rename  { id, label, history }
function handleSessionRename(req, res) {
  return readJsonBody(req, res, (data) => {
    const result = renameSession(data.id, data.label, Boolean(data.history));
    if (!result.ok) return respond(res, result.status || 400, { ok: false, error: result.error });
    return respond(res, 200, Object.assign({ ok: true }, sessionOverview(req)));
  }, 8 * 1024);
}

// POST /api/auth/sessions/block  { id, scope: 'ip'|'device'|'both', note }
function handleSessionBlock(req, res) {
  return readJsonBody(req, res, (data) => {
    const result = blockSession(data.id, String(data.scope || 'both'), data.note);
    if (!result.ok) return respond(res, result.status || 400, { ok: false, error: result.error });
    return respond(res, 200, Object.assign({ ok: true }, sessionOverview(req)));
  }, 8 * 1024);
}

// POST /api/auth/blocklist/remove  { type, value }
function handleBlocklistRemove(req, res) {
  return readJsonBody(req, res, (data) => {
    const result = removeBlock(String(data.type || ''), String(data.value || ''));
    if (!result.ok) return respond(res, 400, { ok: false, error: result.error });
    return respond(res, 200, Object.assign({ ok: true }, sessionOverview(req)));
  }, 8 * 1024);
}

// GET /api/auth/sessions/geo?ip=...
function handleSessionGeo(req, res, url) {
  const ip = String((url && url.searchParams.get('ip')) || '').trim();
  lookupGeo(ip).then((geo) => respond(res, 200, Object.assign({ ok: true, ip }, geo)))
    .catch(() => respond(res, 200, { ok: false, ip, error: '归属地查询失败' }));
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
  assertSameOriginStrict: assertSameOrigin,
  changePassword,
  handleStatus,
  handleSetup,
  getSiteInfo: () => site.getSite(),
  saveSiteInfo: (patch) => site.saveSite(patch),
  handleLogin,
  handleLogout,
  handleChangePassword,
  // 站点信息 + 管理页
  handleSiteGet,
  handleAdminOverview,
  handleSiteSave,
  handleChangeUsername,
  handleTotpSetup,
  handleTotpEnable,
  handleTotpDisable,
  handleBackupCodes,
  handlePasskeyList,
  handlePasskeyRegisterOptions,
  handlePasskeyRegister,
  handlePasskeyDelete,
  handlePasskeyLoginOptions,
  handlePasskeyLogin,
  handleSessionsList,
  handleSessionsRevokeOthers,
  handleSessionRevoke,
  handleSessionRename,
  handleSessionBlock,
  handleBlocklistRemove,
  handleSessionGeo,
  // 供其他模块复用（IndexNow 等）
  readJsonBody,
  respond,
};

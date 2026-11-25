const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const kvfile = require('./kvfile');
const { ROOT_DIR } = require('./storage');

// 验证码签名密钥：优先 CAPTCHA_SECRET 环境变量；否则在 data/ 中生成并持久化随机密钥，
// 与登录凭据彻底解耦（重启后已签发验证码仍然有效）
const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
let CAPTCHA_SECRET = '';
(function loadCaptchaSecret() {
  const envSecret = process.env.CAPTCHA_SECRET;
  if (envSecret) {
    CAPTCHA_SECRET = envSecret;
    return;
  }
  try {
    const secFile = path.join(DATA_DIR, 'captcha-secret.json');
    const stored = kvfile.readJson(secFile, null);
    if (stored && stored.secret) {
      CAPTCHA_SECRET = String(stored.secret);
      return;
    }
    CAPTCHA_SECRET = crypto.randomBytes(32).toString('hex');
    kvfile.writeJson(secFile, { secret: CAPTCHA_SECRET }, { mode: 0o600 });
  } catch (e) {
    // data 目录不可写时的兜底：用进程内随机密钥（重启后已签发的验证码会失效，但功能可用）
    CAPTCHA_SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[captcha] data 目录不可写，使用临时验证码密钥（重启后验证码失效）：', e.message);
  }
})();

const ipRateStore = new Map();
const usedCaptchaNonces = new Map();
// 验证码签发频率：防止脚本无限刷题（刷新数字）拖垮服务
const captchaRateStore = new Map();
const CAPTCHA_WINDOW = 10 * 60 * 1000;   // 统计窗口 10 分钟
const CAPTCHA_MAX = 30;                  // 窗口内最多签发 30 次
const CAPTCHA_BLOCK = 10 * 60 * 1000;    // 超限后封禁 10 分钟

/** 记录一次验证码签发；返回 { ok, retryAfter } */
function hitCaptchaBudget(ip) {
  const now = Date.now();
  let rec = captchaRateStore.get(ip);
  if (!rec) {
    rec = { windowStart: now, count: 0, blockedUntil: 0, lastActive: now };
    captchaRateStore.set(ip, rec);
  }
  rec.lastActive = now;
  if (now < rec.blockedUntil) {
    return { ok: false, retryAfter: Math.ceil((rec.blockedUntil - now) / 1000) };
  }
  if (now - rec.windowStart > CAPTCHA_WINDOW) {
    rec.windowStart = now;
    rec.count = 0;
  }
  rec.count += 1;
  if (rec.count > CAPTCHA_MAX) {
    rec.blockedUntil = now + CAPTCHA_BLOCK;
    return { ok: false, retryAfter: Math.ceil(CAPTCHA_BLOCK / 1000) };
  }
  return { ok: true, remaining: CAPTCHA_MAX - rec.count };
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

function generateMathCaptcha() {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = 0, b = 0, ans = 0;
  if (op === '+') {
    a = Math.floor(Math.random() * 15) + 3;
    b = Math.floor(Math.random() * 15) + 2;
    ans = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 15) + 10;
    b = Math.floor(Math.random() * 9) + 1;
    ans = a - b;
  } else {
    a = Math.floor(Math.random() * 8) + 2;
    b = Math.floor(Math.random() * 8) + 2;
    ans = a * b;
  }
  const exp = Date.now() + 5 * 60 * 1000;
  const nonce = crypto.randomBytes(6).toString('hex');
  const payload = `${exp}.${nonce}`;
  const sig = crypto.createHmac('sha256', CAPTCHA_SECRET).update(`${payload}.${ans}`).digest('hex').slice(0, 24);
  return {
    question: `${a} ${op} ${b} = ?`,
    token: `${payload}.${sig}`
  };
}

function verifyMathCaptcha(token, userAnswer) {
  if (!token || userAnswer === undefined || userAnswer === '') return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const exp = Number(parts[0]);
  const nonce = parts[1];
  const sig = parts[2];

  if (!exp || Date.now() > exp) return false;
  if (usedCaptchaNonces.has(nonce)) return false;

  const cleanAns = String(userAnswer).trim();
  const expectedSig = crypto.createHmac('sha256', CAPTCHA_SECRET).update(`${exp}.${nonce}.${cleanAns}`).digest('hex').slice(0, 24);
  if (sig !== expectedSig) return false;

  usedCaptchaNonces.set(nonce, exp);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [nonce, exp] of usedCaptchaNonces.entries()) {
    if (now > exp) usedCaptchaNonces.delete(nonce);
  }
  for (const [ip, rec] of ipRateStore.entries()) {
    if (now - rec.lastActive > 3600 * 1000 && now > rec.blockedUntil) {
      ipRateStore.delete(ip);
    }
  }
  for (const [ip, rec] of captchaRateStore.entries()) {
    if (now - rec.lastActive > 3600 * 1000 && now > rec.blockedUntil) {
      captchaRateStore.delete(ip);
    }
  }
}, 60 * 1000);

module.exports = {
  ipRateStore,
  captchaRateStore,
  hitCaptchaBudget,
  getClientIp,
  generateMathCaptcha,
  verifyMathCaptcha
};
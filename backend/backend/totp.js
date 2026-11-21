/**
 * backend/totp.js — TOTP（RFC 6238）两步验证，零依赖
 *
 * - 密钥 20 字节随机数，Base32 展示给用户，写入认证器 App（Google / Microsoft / 1Password…）
 * - 6 位验证码、30 秒步长，校验窗口 ±1（允许前后各 30 秒时钟偏差）
 * - 一次性备用码：10 个 8 位字符，服务端只存 SHA-256，用过即失效
 */

const crypto = require('crypto');

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I/O/0/1

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secretBuf, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000) >>> 0, 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

function totp(secretB32, atMs = Date.now(), stepSeconds = 30, digits = 6) {
  const counter = Math.floor(Math.floor(atMs / 1000) / stepSeconds);
  return hotp(base32Decode(secretB32), counter, digits);
}

/** 校验验证码：允许 ±window 个步长的时钟偏差；恒定时间比较 */
function verifyTotp(secretB32, code, window = 1, atMs = Date.now(), stepSeconds = 30) {
  const input = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(input)) return false;
  const counter = Math.floor(Math.floor(atMs / 1000) / stepSeconds);
  const a = Buffer.from(input);
  let ok = false;
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(base32Decode(secretB32), counter + i, 6));
    if (expected.length === a.length && crypto.timingSafeEqual(expected, a)) ok = true;
  }
  return ok;
}

function otpauthUrl(secretB32, account, issuer) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer: issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function randomBackupCode() {
  let raw = '';
  const bytes = crypto.randomBytes(8);
  for (const b of bytes) raw += BACKUP_ALPHABET[b % BACKUP_ALPHABET.length];
  return raw.slice(0, 4) + '-' + raw.slice(4, 8);
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).replace(/[^A-Za-z0-9]/g, '').toUpperCase()).digest('hex');
}

/** 生成 n 个备用码：返回明文（只展示一次）与哈希（落盘） */
function generateBackupCodes(n = 10) {
  const plain = [];
  const hashed = [];
  for (let i = 0; i < n; i++) {
    const code = randomBackupCode();
    plain.push(code);
    hashed.push(hashCode(code));
  }
  return { plain, hashed };
}

/** 校验备用码，命中时返回索引（调用方负责删除），未命中返回 -1；恒定时间逐个比较 */
function matchBackupCode(code, hashedList) {
  if (!Array.isArray(hashedList) || !hashedList.length) return -1;
  const target = Buffer.from(hashCode(code), 'hex');
  let hit = -1;
  for (let i = 0; i < hashedList.length; i++) {
    const candidate = Buffer.from(String(hashedList[i]), 'hex');
    if (candidate.length === target.length && crypto.timingSafeEqual(candidate, target)) hit = i;
  }
  return hit;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  hotp,
  totp,
  verifyTotp,
  otpauthUrl,
  generateBackupCodes,
  matchBackupCode
};

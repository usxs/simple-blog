'use strict';

// 文章 / 片段的对称加密：scrypt 派生密钥 + AES-256-GCM。
// 所有密文都带独立随机 salt+iv，口令不落盘；错误口令由 GCM tag 校验失败拒绝。

const crypto = require('crypto');

const KEY_LEN = 32;
const COST = 16384;          // scrypt N=2^14，约 50ms，移动端也可接受
const BLOCK = 8;
const PARALLEL = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function deriveKey(password, salt, cost) {
  return crypto.scryptSync(String(password == null ? '' : password), salt, KEY_LEN, {
    N: Number(cost) || COST,
    r: BLOCK,
    p: PARALLEL,
    maxmem: 128 * 1024 * 1024
  });
}

// 返回可直接 JSON 化 / 落盘的对象
function encryptText(plain, password) {
  const text = String(plain == null ? '' : plain);
  if (!password) {
    const err = new Error('加密口令不能为空');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return {
    v: 1,
    cost: COST,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: enc.toString('base64')
  };
}

function decryptText(payload, password) {
  if (!payload || !payload.data || !payload.salt || !payload.iv || !payload.tag) {
    const err = new Error('密文格式不完整');
    err.code = 'BAD_PAYLOAD';
    throw err;
  }
  const salt = Buffer.from(String(payload.salt), 'base64');
  const iv = Buffer.from(String(payload.iv), 'base64');
  const tag = Buffer.from(String(payload.tag), 'base64');
  const data = Buffer.from(String(payload.data), 'base64');
  const key = deriveKey(password, salt, payload.cost);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    const err = new Error('口令错误或内容已损坏');
    err.code = 'BAD_PASSWORD';
    throw err;
  }
}

function bufferToObject(buf) {
  return {
    v: 1,
    salt: buf.slice(0, SALT_BYTES).toString('base64'),
    iv: buf.slice(SALT_BYTES, SALT_BYTES + IV_BYTES).toString('base64'),
    tag: buf.slice(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + 16).toString('base64'),
    data: buf.slice(SALT_BYTES + IV_BYTES + 16).toString('base64')
  };
}

function isEncryptedArticle(post) {
  return Boolean(post && (post.enc === true || post.enc === 1 || post.enc === '1' || post.enc === 'true'));
}

// ---- 片段加密 ----
// 写作语法：
// :::lock 口令
// 任意 markdown（文字/图片）
// :::
// 保存时替换为 :::locked <base64(json)> 单行，前端只拿到密文。

const LOCK_OPEN = /^:::lock(?:\s+(.+?))?\s*$/;
const LOCK_CLOSED = /^:::locked\s+([A-Za-z0-9+/=]+)\s*$/;

function hasLockedFragment(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (LOCK_CLOSED.test(lines[i].trim())) return true;
  }
  return false;
}

// 把编辑器里的明文 :::lock 块加密成占位块；返回 { content, count }
function encryptFragments(markdown) {
  const lines = String(markdown == null ? '' : markdown).split(/\r?\n/);
  const out = [];
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const m = trimmed.match(LOCK_OPEN);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    const password = String(m[1] || '').trim();
    if (!password) {
      const err = new Error('加密片段缺少口令，请写成 :::lock 口令');
      err.code = 'PASSWORD_REQUIRED';
      throw err;
    }
    const body = [];
    let closed = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === ':::') { closed = true; i = j; break; }
      body.push(lines[j]);
    }
    if (!closed) {
      const err = new Error('加密片段缺少结束标记 :::');
      err.code = 'BAD_FRAGMENT';
      throw err;
    }
    const payload = encryptText(body.join('\n'), password);
    const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    out.push(':::locked ' + b64);
    out.push(':::');
    count++;
  }
  return { content: out.join('\n'), count: count };
}

function decryptFragment(b64, password) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(String(b64 || ''), 'base64').toString('utf8'));
  } catch (e) {
    const err = new Error('加密片段格式损坏');
    err.code = 'BAD_PAYLOAD';
    throw err;
  }
  return decryptText(payload, password);
}

module.exports = {
  encryptText: encryptText,
  decryptText: decryptText,
  isEncryptedArticle: isEncryptedArticle,
  encryptFragments: encryptFragments,
  hasLockedFragment: hasLockedFragment,
  decryptFragment: decryptFragment
};

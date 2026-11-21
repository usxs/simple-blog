/**
 * backend/webauthn.js — WebAuthn（通行密钥 / Passkey）服务端校验，零依赖
 *
 * 只实现登录型（server-side）凭据所需的最小集合：
 *  - 注册：校验 clientData / challenge / origin / rpIdHash，解析 attestationObject 的 CBOR，
 *    取出 credentialId 与 COSE 公钥后落盘（不保存私钥，私钥永远在用户设备上）。
 *  - 登录：用存储的公钥验证 authenticatorData || SHA256(clientDataJSON) 的签名，
 *    并检查签名计数器是否回退（克隆检测）。
 *
 * 支持算法：ES256（-7，P-256）、RS256（-257，RSASSA-PKCS1-v1_5）。
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Base64URL
// ---------------------------------------------------------------------------

function b64uEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s, 'base64');
}

// ---------------------------------------------------------------------------
// 最小 CBOR 解码器（只处理 WebAuthn 会出现的类型）
// ---------------------------------------------------------------------------

function cborDecode(buf, offset = 0) {
  if (offset >= buf.length) throw new Error('CBOR 长度不足');
  const first = buf[offset];
  const major = first >> 5;
  const info = first & 0x1f;
  let pos = offset + 1;
  let len = info;

  if (info === 24) {
    len = buf[pos]; pos += 1;
  } else if (info === 25) {
    len = buf.readUInt16BE(pos); pos += 2;
  } else if (info === 26) {
    len = buf.readUInt32BE(pos); pos += 4;
  } else if (info === 27) {
    const hi = buf.readUInt32BE(pos);
    const lo = buf.readUInt32BE(pos + 4);
    len = hi * 0x100000000 + lo;
    pos += 8;
  } else if (info === 31) {
    throw new Error('不支持不定长 CBOR');
  }

  switch (major) {
    case 0: // unsigned int
      return { value: len, offset: pos };
    case 1: // negative int
      return { value: -1 - len, offset: pos };
    case 2: { // byte string
      const value = buf.subarray(pos, pos + len);
      return { value, offset: pos + len };
    }
    case 3: { // text string
      const value = buf.toString('utf8', pos, pos + len);
      return { value, offset: pos + len };
    }
    case 4: { // array
      const value = [];
      let p = pos;
      for (let i = 0; i < len; i++) {
        const item = cborDecode(buf, p);
        value.push(item.value);
        p = item.offset;
      }
      return { value, offset: p };
    }
    case 5: { // map
      const value = {};
      let p = pos;
      for (let i = 0; i < len; i++) {
        const key = cborDecode(buf, p);
        const val = cborDecode(buf, key.offset);
        value[String(key.value)] = val.value;
        p = val.offset;
      }
      return { value, offset: p };
    }
    case 7: // simple / float
      if (info === 20) return { value: false, offset: pos };
      if (info === 21) return { value: true, offset: pos };
      if (info === 22) return { value: null, offset: pos };
      return { value: null, offset: pos };
    default:
      throw new Error('无法解析的 CBOR 类型: ' + major);
  }
}

// ---------------------------------------------------------------------------
// COSE 公钥 → Node KeyObject（拼 DER，交给 crypto 校验）
// ---------------------------------------------------------------------------

function derLen(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTag(tag, content) {
  return Buffer.concat([Buffer.from([tag]), derLen(content.length), content]);
}

const SEQ = 0x30, INT = 0x02, BITSTR = 0x03, OID = 0x06, NULL = 0x05;

function derInt(buf) {
  let b = Buffer.from(buf);
  while (b.length > 1 && b[0] === 0 && (b[1] & 0x80) === 0) b = b.subarray(1);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return derTag(INT, b);
}

function coseToPublicKey(cose) {
  const kty = cose[1];
  const alg = cose[3];

  if (kty === 2) { // EC2
    const crv = cose[-1];
    if (crv !== 1) throw new Error('仅支持 P-256 曲线');
    const x = Buffer.from(cose[-2]);
    const y = Buffer.from(cose[-3]);
    const oidEc = Buffer.from('06072a8648ce3d0201', 'hex');
    const oidP256 = Buffer.from('06082a8648ce3d030107', 'hex');
    const spki = derTag(SEQ, Buffer.concat([
      derTag(SEQ, Buffer.concat([oidEc, oidP256])),
      derTag(BITSTR, Buffer.concat([Buffer.from([0]), Buffer.from([4]), x, y]))
    ]));
    return { key: crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' }), alg: alg || -7 };
  }

  if (kty === 3) { // RSA
    const n = Buffer.from(cose[-1]);
    const e = Buffer.from(cose[-2]);
    const oidRsa = Buffer.from('06092a864886f70d010101', 'hex');
    const rsaKey = derTag(SEQ, Buffer.concat([derInt(n), derInt(e)]));
    const spki = derTag(SEQ, Buffer.concat([
      derTag(SEQ, Buffer.concat([oidRsa, derTag(NULL, Buffer.alloc(0))])),
      derTag(BITSTR, Buffer.concat([Buffer.from([0]), rsaKey]))
    ]));
    return { key: crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' }), alg: alg || -257 };
  }

  throw new Error('不支持的凭据公钥类型: ' + kty);
}

// ---------------------------------------------------------------------------
// authenticatorData 解析
// ---------------------------------------------------------------------------

function parseAuthData(buf) {
  if (buf.length < 37) throw new Error('authenticatorData 长度不足');
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf[32];
  const counter = buf.readUInt32BE(33);
  const out = { rpIdHash, flags, counter, credentialId: null, credentialPublicKey: null };

  const hasAttested = (flags & 0x40) !== 0;
  if (hasAttested) {
    if (buf.length < 55) throw new Error('attested credential data 不完整');
    let pos = 37 + 16; // aaguid
    const credIdLen = buf.readUInt16BE(pos);
    pos += 2;
    out.credentialId = buf.subarray(pos, pos + credIdLen);
    pos += credIdLen;
    const cose = cborDecode(buf, pos);
    out.credentialPublicKey = cose.value;
    out.credentialPublicKeyBytes = buf.subarray(pos, cose.offset);
  }
  return out;
}

function parseClientData(clientDataJSON) {
  let data;
  try {
    data = JSON.parse(b64uDecode(clientDataJSON).toString('utf8'));
  } catch (e) {
    throw new Error('clientDataJSON 解析失败');
  }
  return data;
}

function checkClientData(data, expectedType, expectedChallenge, expectedOrigins) {
  if (data.type !== expectedType) throw new Error('WebAuthn 操作类型不匹配');
  if (data.challenge !== expectedChallenge) throw new Error('WebAuthn challenge 不匹配');
  const origin = String(data.origin || '');
  if (expectedOrigins.length && !expectedOrigins.includes(origin)) {
    throw new Error('WebAuthn 来源不匹配: ' + origin);
  }
  if (data.crossOrigin === true) throw new Error('拒绝跨源 WebAuthn 请求');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

// ---------------------------------------------------------------------------
// 对外：注册与登录校验
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {string} p.clientDataJSON  base64url
 * @param {string} p.attestationObject base64url
 * @param {string} p.expectedChallenge base64url
 * @param {string} p.rpId
 * @param {string[]} p.expectedOrigins
 */
function verifyRegistration({ clientDataJSON, attestationObject, expectedChallenge, rpId, expectedOrigins }) {
  const clientData = parseClientData(clientDataJSON);
  checkClientData(clientData, 'webauthn.create', expectedChallenge, expectedOrigins);

  const att = cborDecode(b64uDecode(attestationObject)).value;
  if (!att || !att.authData) throw new Error('attestationObject 缺少 authData');

  const authData = parseAuthData(Buffer.from(att.authData));
  if (!authData.rpIdHash.equals(sha256(Buffer.from(rpId)))) {
    throw new Error('rpIdHash 与站点域名不匹配（RP ID 配置错误）');
  }
  if (!(authData.flags & 0x01)) throw new Error('用户未完成身份确认');
  if (!authData.credentialId || !authData.credentialPublicKey) throw new Error('缺少凭据公钥');

  const { key, alg } = coseToPublicKey(authData.credentialPublicKey);
  return {
    credentialId: b64uEncode(authData.credentialId),
    coseRaw: b64uEncode(authData.credentialPublicKeyBytes),
    alg: alg,
    counter: authData.counter
  };
}

/**
 * @param {object} p
 * @param {string} p.clientDataJSON
 * @param {string} p.authenticatorData
 * @param {string} p.signature
 * @param {string} p.expectedChallenge
 * @param {string} p.rpId
 * @param {string[]} p.expectedOrigins
 * @param {string} p.coseRaw        注册时保存的 COSE 公钥（base64url 原始字节）
 * @param {number} p.storedCounter
 */
function verifyAssertion({ clientDataJSON, authenticatorData, signature, expectedChallenge, rpId, expectedOrigins, coseRaw, storedCounter }) {
  const clientData = parseClientData(clientDataJSON);
  checkClientData(clientData, 'webauthn.get', expectedChallenge, expectedOrigins);

  const authBuf = b64uDecode(authenticatorData);
  const authData = parseAuthData(authBuf);
  if (!authData.rpIdHash.equals(sha256(Buffer.from(rpId)))) {
    throw new Error('rpIdHash 与站点域名不匹配（RP ID 配置错误）');
  }
  if (!(authData.flags & 0x01)) throw new Error('用户未完成身份确认');

  const coseMap = cborDecode(b64uDecode(coseRaw)).value;
  const { key } = coseToPublicKey(coseMap);
  const signedData = Buffer.concat([authBuf, sha256(b64uDecode(clientDataJSON))]);
  const sig = b64uDecode(signature);
  let ok = false;
  try {
    ok = crypto.verify('sha256', signedData, key, sig);
  } catch (e) {
    ok = false;
  }
  if (!ok) throw new Error('签名校验失败');

  const prev = Number(storedCounter) || 0;
  if (authData.counter !== 0 && prev !== 0 && authData.counter <= prev) {
    throw new Error('签名计数器异常，凭据可能已被复制');
  }
  return { counter: authData.counter, flags: authData.flags };
}

module.exports = {
  b64uEncode,
  b64uDecode,
  cborDecode,
  coseToPublicKey,
  parseAuthData,
  verifyRegistration,
  verifyAssertion
};

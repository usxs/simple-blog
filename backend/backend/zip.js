/**
 * backend/zip.js — 纯 JS 的 ZIP 打包 / 解包（零第三方依赖）
 *
 * 只做博客迁移需要的那一小块：store（不压缩）与 deflate 两种方法，
 * 不支持 ZIP64 / 加密 / 分卷（单个迁移包远小于 4GB，够用）。
 *
 * 打包：writeZip([{ name, data, mtime }]) -> Buffer
 * 解包：readZip(buffer) -> [{ name, data, isDir }]
 *
 * 之所以不用系统 zip/unzip 命令：迁移包可能由访客在浏览器里上传，
 * 服务器（包含 Windows 主机、精简版 alpine）不保证有 zip 命令行；
 * 纯 JS 实现可以保证任何环境行为一致。
 */

'use strict';

const zlib = require('zlib');

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

// ---- CRC32 ----
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const year = Math.max(1980, d.getFullYear());
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
  const day = (((year - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { time: time, date: day };
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(String(data == null ? '' : data), 'utf8');
}

// 统一分隔符、去掉开头的 / 与 ..，防止解包写出到目标目录之外
function safeName(name) {
  return String(name || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(seg => seg && seg !== '.' && seg !== '..')
    .join('/');
}

function writeZip(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  (entries || []).forEach((entry) => {
    const name = safeName(entry.name);
    if (!name) return;
    const data = toBuffer(entry.data);
    const nameBuf = Buffer.from(name, 'utf8');
    const stamp = dosDateTime(entry.mtime || Date.now());

    // 小于 64 字节的内容压缩反而更大，直接 store
    let method = 8;
    let payload = zlib.deflateRawSync(data, { level: 6 });
    if (payload.length >= data.length || data.length < 64) {
      method = 0;
      payload = data;
    }
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);              // version needed
    local.writeUInt16LE(0x0800, 6);          // UTF-8 文件名
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    fileParts.push(local, nameBuf, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(20, 4);            // version made by
    central.writeUInt16LE(20, 6);            // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);            // extra
    central.writeUInt16LE(0, 32);            // comment
    central.writeUInt16LE(0, 34);            // disk
    central.writeUInt16LE(0, 36);            // internal attrs
    central.writeUInt32LE(0, 38);            // external attrs
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + payload.length;
  });

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(centralParts.length / 2, 8);
  eocd.writeUInt16LE(centralParts.length / 2, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(fileParts), centralBuf, eocd]);
}

// DOS 时间戳 -> 毫秒（解析失败返回 0，调用方自行兜底）
function dosToMs(dosDate, dosTime) {
  if (!dosDate) return 0;
  const year = 1980 + ((dosDate >> 9) & 0x7F);
  const month = ((dosDate >> 5) & 0x0F) || 1;
  const day = dosDate & 0x1F || 1;
  const hour = (dosTime >> 11) & 0x1F;
  const minute = (dosTime >> 5) & 0x3F;
  const second = (dosTime & 0x1F) * 2;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function isZip(buf) {
  return Buffer.isBuffer(buf) && buf.length > 4 && buf.readUInt32LE(0) === SIG_LOCAL;
}

function findEocd(buf) {
  const maxScan = Math.min(buf.length, 0xFFFF + 22);
  for (let i = buf.length - 22; i >= buf.length - maxScan && i >= 0; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

/**
 * 解包 Zip。
 * @param {Buffer} buf
 * @returns {Array<{name: string, data: Buffer, isDir: boolean}>}
 */
function readZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('不是有效的 ZIP 文件');
  const eocd = findEocd(buf);
  if (eocd === -1) throw new Error('ZIP 结构损坏：找不到目录结尾');
  const total = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  if (!total) return [];

  const out = [];
  for (let n = 0; n < total; n++) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== SIG_CENTRAL) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const rawSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const dosTime = buf.readUInt16LE(ptr + 12);
    const dosDate = buf.readUInt16LE(ptr + 14);
    const name = safeName(buf.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8'));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (!name) continue;
    if (name.endsWith('/') || (rawSize === 0 && compSize === 0)) {
      out.push({ name: name.replace(/\/$/, ''), data: Buffer.alloc(0), isDir: true });
      continue;
    }
    if (localOffset + 30 > buf.length) continue;
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > buf.length) continue;
    const payload = buf.slice(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = Buffer.from(payload);
    else if (method === 8) {
      try { data = zlib.inflateRawSync(payload); } catch (e) { continue; }
    } else {
      continue;                              // 不支持的压缩算法（如 bzip2）直接跳过
    }
    out.push({ name, data, isDir: false, mtime: dosToMs(dosDate, dosTime) });
  }
  return out;
}

module.exports = {
  writeZip,
  readZip,
  isZip,
  crc32,
  safeName,
  dosToMs
};

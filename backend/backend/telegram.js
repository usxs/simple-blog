'use strict';

// 瞬间 → Telegram 频道同步
// 参考 halo-plugin-telegram-moment：新建瞬间时发到频道，编辑时重发（先删旧消息），删除时撤回。
// 配置存 data/telegram.json（0600），消息映射存 data/telegram-map.json。

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'telegram.json');
const MAP_FILE = path.join(DATA_DIR, 'telegram-map.json');
const DEFAULT_SITE = String(process.env.SITE_PUBLIC_URL || 'https://example.com').replace(/\/+$/, '');
const TIMEOUT_MS = 12000;
const MAX_IMAGES = 4;

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    /* 交给上层提示 */
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function normalizeConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled === undefined ? false : !!src.enabled,
    botToken: String(src.botToken || '').trim(),
    chatId: String(src.chatId || '').trim(),
    siteUrl: String(src.siteUrl || DEFAULT_SITE).replace(/\/+$/, ''),
    silent: !!src.silent,
    updatedAt: Number(src.updatedAt) || 0
  };
}

function getConfig() {
  return normalizeConfig(readJson(CONFIG_FILE, {}));
}

function saveConfig(patch) {
  const current = getConfig();
  const next = normalizeConfig(Object.assign({}, current, patch || {}));
  if (patch && patch.botToken === undefined) next.botToken = current.botToken;
  next.updatedAt = Date.now();
  writeJson(CONFIG_FILE, next);
  return next;
}

// 给前端用：token 只露出尾巴，判断是否可用
function publicConfig(cfg) {
  const c = cfg || getConfig();
  const token = c.botToken;
  return {
    enabled: c.enabled,
    chatId: c.chatId,
    siteUrl: c.siteUrl,
    silent: c.silent,
    hasToken: !!token,
    botTokenMasked: token ? token.slice(0, 8) + '…' + token.slice(-4) : '',
    updatedAt: c.updatedAt
  };
}

// 把 Telegram 的英文报错翻译成能照着改的中文
function friendlyError(desc, statusCode) {
  const text = String(desc || '');
  if (/unauthorized/i.test(text) || statusCode === 401) return 'Bot Token 无效，请重新从 @BotFather 复制';
  if (/chat not found/i.test(text)) return '找不到这个频道：检查频道 ID（形如 @name 或 -100…），并确认机器人已加入频道';
  if (/not enough rights|forbidden|bot was blocked/i.test(text) || statusCode === 403) return '机器人没有发消息权限：请把机器人设为频道管理员，或允许它发言';
  if (/wrong file identifier|failed to get http url content/i.test(text)) return '图片链接无法被 Telegram 读取，检查站点地址是否能公网访问';
  if (/message to (edit|delete)/i.test(text)) return '要编辑 / 删除的消息不存在（可能已在频道里手动删除）';
  return text || ('HTTP ' + statusCode);
}

function api(cfg, method, payload) {
  return new Promise(function (resolve, reject) {
    if (!cfg.botToken) return reject(new Error('还没有填写 Bot Token'));
    const body = JSON.stringify(payload || {});
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + cfg.botToken + '/' + method,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: TIMEOUT_MS
    }, function (res) {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { if (buf.length < 200000) buf += c; });
      res.on('end', function () {
        let data = null;
        try { data = JSON.parse(buf); } catch (e) { data = null; }
        if (data && data.ok) return resolve(data.result);
        const desc = data && data.description ? data.description : ('HTTP ' + res.statusCode);
        reject(new Error(friendlyError(desc, res.statusCode)));
      });
    });
    req.on('timeout', function () { req.destroy(new Error('连接 Telegram 超时')); });
    req.on('error', function (err) {
      reject(new Error(/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONN/i.test(err.code || '')
        ? '连不上 api.telegram.org，检查服务器网络 / DNS'
        : (err.message || '网络错误')));
    });
    req.write(body);
    req.end();
  });
}

// 把 Markdown 瞬间压成适合发频道的纯文本
function toPlainText(markdown) {
  let text = String(markdown || '');
  text = text.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, function (_m, code) { return code.trim(); });
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_m, label, url) {
    return label === url ? url : label + ' ' + url;
  });
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*([-*+])\s+/gm, '· ');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > 3800) text = text.slice(0, 3790) + '…';
  return text;
}

function collectImages(markdown, siteUrl) {
  const out = [];
  const re = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  let m;
  while ((m = re.exec(String(markdown || ''))) && out.length < MAX_IMAGES) {
    let url = m[1];
    if (url.indexOf('//') === 0) url = 'https:' + url;
    if (url.charAt(0) === '/') url = siteUrl + url;
    if (!/^https?:\/\//i.test(url)) continue;
    if (out.indexOf(url) === -1) out.push(url);
  }
  return out;
}

function buildCaption(moment) {
  const text = toPlainText(moment.content);
  const date = String(moment.date || '').trim();
  const tag = String(moment.tag || '').trim();
  const tail = [date, tag ? '#' + tag : ''].filter(Boolean).join(' · ');
  const full = tail ? text + '\n\n' + tail : text;
  return full.length > 1024 ? full.slice(0, 1015) + '…' : full;
}

async function sendMoment(cfg, moment) {
  const site = cfg.siteUrl || DEFAULT_SITE;
  const images = collectImages(moment.content, site);
  const text = toPlainText(moment.content);
  const tail = [String(moment.date || '').trim(), String(moment.tag || '').trim() ? '#' + String(moment.tag).trim() : '']
    .filter(Boolean).join(' · ');
  const fullText = tail ? text + '\n\n' + tail : text;
  const ids = [];

  if (images.length === 1) {
    const res = await api(cfg, 'sendPhoto', {
      chat_id: cfg.chatId,
      photo: images[0],
      caption: buildCaption(moment),
      disable_notification: !!cfg.silent
    });
    if (res && res.message_id) ids.push(res.message_id);
    return ids;
  }

  if (images.length > 1) {
    const media = images.map(function (url, i) {
      const item = { type: 'photo', media: url };
      if (i === 0) item.caption = buildCaption(moment);
      return item;
    });
    const res = await api(cfg, 'sendMediaGroup', {
      chat_id: cfg.chatId,
      media: media,
      disable_notification: !!cfg.silent
    });
    if (Array.isArray(res)) res.forEach(function (r) { if (r && r.message_id) ids.push(r.message_id); });
    return ids;
  }

  const res = await api(cfg, 'sendMessage', {
    chat_id: cfg.chatId,
    text: fullText.length > 4000 ? fullText.slice(0, 3990) + '…' : fullText,
    disable_web_page_preview: false,
    disable_notification: !!cfg.silent
  });
  if (res && res.message_id) ids.push(res.message_id);
  return ids;
}

async function deleteMessages(cfg, ids) {
  for (let i = 0; i < ids.length; i++) {
    try {
      await api(cfg, 'deleteMessage', { chat_id: cfg.chatId, message_id: ids[i] });
    } catch (e) {
      // 消息可能已被手动删除，忽略
    }
  }
}

function readMap() {
  return readJson(MAP_FILE, {});
}

// 新建 / 编辑瞬间：先撤回旧消息，再发新的（编辑后内容与图片都可能变，重发最稳）
async function syncMoment(moment) {
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return { ok: false, skipped: true };
  if (!moment || !moment.id) return { ok: false, skipped: true, error: '缺少瞬间 ID' };

  const map = readMap();
  const old = map[moment.id];
  if (old && Array.isArray(old.messageIds) && old.messageIds.length) {
    try { await deleteMessages(Object.assign({}, cfg, { chatId: old.chatId || cfg.chatId }), old.messageIds); } catch (e) {}
  }

  const ids = await sendMoment(cfg, moment);
  map[moment.id] = { messageIds: ids, chatId: cfg.chatId, at: Date.now() };
  writeJson(MAP_FILE, map);
  return { ok: ids.length > 0, messageIds: ids };
}

// 删除瞬间：撤回频道里的消息
async function forgetMoment(momentId) {
  const cfg = getConfig();
  const map = readMap();
  const rec = map[momentId];
  if (!rec) return { ok: true, skipped: true };
  delete map[momentId];
  writeJson(MAP_FILE, map);
  if (!cfg.botToken) return { ok: true, skipped: true };
  await deleteMessages(Object.assign({}, cfg, { chatId: rec.chatId || cfg.chatId }), rec.messageIds || []);
  return { ok: true };
}

// 测试：校验 token 并往频道发一条测试消息
async function testConnection() {
  const cfg = getConfig();
  if (!cfg.botToken) throw new Error('还没有填写 Bot Token');
  if (!cfg.chatId) throw new Error('还没有填写频道 / 会话 ID');
  const me = await api(cfg, 'getMe', {});
  const msg = await api(cfg, 'sendMessage', {
    chat_id: cfg.chatId,
    text: '✅ 瞬间同步已连通\n这是一条来自后台「瞬间同步」的测试消息。',
    disable_notification: true
  });
  return {
    ok: true,
    botUsername: me && me.username ? '@' + me.username : '',
    messageId: msg && msg.message_id ? msg.message_id : 0
  };
}

function syncedCount() {
  return Object.keys(readMap()).length;
}

module.exports = {
  CONFIG_FILE,
  MAP_FILE,
  getConfig,
  saveConfig,
  publicConfig,
  syncMoment,
  forgetMoment,
  testConnection,
  syncedCount,
  toPlainText,
  collectImages
};

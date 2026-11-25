/**
 * backend/notify.js — 通知（SMTP 邮件 + Bark 推送）
 *
 * 配置存放在 data/notify.json：
 *   mail      { enabled, host, port, secure, user, pass, from, fromName }
 *   bark      { enabled, server, key, group }
 *   templates { comment_reply, link_received, link_result, security_alert,
 *               bark_comment, bark_link, bark_security }
 *
 * 模板里可用变量：{{site}} {{name}} {{title}} {{url}} {{content}} {{time}} {{status}} {{email}}
 */

const fs = require('fs');
const kvfile = require('./kvfile');
const path = require('path');
const crypto = require('crypto');
const mailer = require('./mailer');
const { ROOT_DIR } = require('./storage');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'notify.json');

const DEFAULT_SITE = String(process.env.SITE_PUBLIC_URL || 'https://example.com').replace(/\/+$/, '');

function siteLabel() {
  try {
    const s = require('./site').getSite();
    return String((s && (s.name || s.title)) || DEFAULT_SITE);
  } catch (e) { return DEFAULT_SITE; }
}

function ownerName() {
  try {
    const s = require('./site').getSite();
    return String((s && (s.name || s.title)) || '站长');
  } catch (e) { return '站长'; }
}

const DEFAULT_TEMPLATES = {
  comment_reply: {
    subject: '{{site}} · {{replier}} 回复了你在《{{title}}》下的留言',
    text: [
      '尊敬的 {{name}}：',
      '',
      '{{replier}} 刚刚回复了你，就在 {{site}} 的《{{title}}》下面。',
      '',
      '回复内容：',
      '{{content}}',
      '',
      '回到这一页继续聊：',
      '{{url}}',
      '',
      '本条通知由 {{site}} 自动发送，不需要回复。'
    ].join('\n')
  },
  comment_received: {
    subject: '{{site}} · 新评论：{{name}} 在《{{title}}》留言',
    text: [
      '{{site}} 收到一条新评论。',
      '',
      '评论人：{{name}}',
      '文章：{{title}}',
      '内容：',
      '{{content}}',
      '',
      '时间：{{time}}',
      '',
      '可以到后台「评论审核」里查看或回复。',
      '',
      '本条通知由 {{site}} 自动发送。'
    ].join('\n')
  },
  link_received: {
    subject: '{{site}} · 新的友链申请：{{name}}',
    text: [
      '有新网站申请加入 {{site}} 的友链。',
      '',
      '网站名：{{name}}',
      '地址：{{url}}',
      '图标：{{content}}',
      '提交时间：{{time}}',
      '',
      '可以到后台「友链」里审核。',
      '',
      '本条通知由 {{site}} 自动发送。'
    ].join('\n')
  },
  link_result: {
    subject: '{{site}} · 友链申请{{status}}：{{name}}',
    text: [
      '您好，{{name}}：',
      '',
      '您在 {{site}} 提交的友链申请{{status}}。',
      '{{reasonLine}}',
      '网站名：{{name}}',
      '地址：{{url}}',
      '审核时间：{{time}}',
      '',
      '本条通知由 {{site}} 自动发送，不需要回复。'
    ].join('\n')
  },
  security_alert: {
    subject: '{{site}} · 安全提醒：{{title}}',
    text: [
      '{{site}} 检测到可疑行为。',
      '',
      '类型：{{title}}',
      '详情：{{content}}',
      '时间：{{time}}',
      '',
      '如果这不是你本人操作，建议尽快修改密码，并检查后台登录会话。',
      '',
      '本条通知由 {{site}} 自动发送。'
    ].join('\n')
  },
  bark_comment: {
    title: '新评论 · {{name}}',
    text: '《{{title}}》\n\n{{content}}\n\n{{time}} · 点开查看'
  },
  bark_link: {
    title: '友链申请 · {{name}}',
    text: '站点：{{name}}\n地址：{{url}}\n时间：{{time}}\n\n点开去审核'
  },
  bark_security: {
    title: '安全提醒 · {{site}}',
    text: '{{content}}\n\n{{time}}'
  }
};

const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES);
const MAIL_TEMPLATES = ['comment_reply', 'link_received', 'link_result', 'security_alert'];

// 模板分组：user = 发给站外用户（只走邮件），admin = 发给管理员（邮件 / Bark 可选）
const TEMPLATE_META = {
  comment_reply: { audience: 'user', channel: 'mail', label: '评论回复（发给访客）' },
  comment_received: { audience: 'admin', channel: 'mail', label: '新评论（发给站长）' },
  link_result: { audience: 'user', channel: 'mail', label: '友链结果（发给申请人）' },
  link_received: { audience: 'admin', channel: 'mail', label: '友链申请（发给站长）' },
  security_alert: { audience: 'admin', channel: 'mail', label: '安全提醒（发给站长）' },
  bark_comment: { audience: 'admin', channel: 'bark', label: '评论推送' },
  bark_link: { audience: 'admin', channel: 'bark', label: '友链推送' },
  bark_security: { audience: 'admin', channel: 'bark', label: '安全推送' }
};

// 管理员通知渠道：默认两个都开
const DEFAULT_CHANNELS = { adminMail: true, adminBark: true };
const LIMITS = { host: 120, user: 120, pass: 200, from: 160, fromName: 40, server: 200, key: 200, group: 60, subject: 160, text: 4000, title: 80 };

function readJson() {
  const data = kvfile.readJson(CONFIG_FILE, null);
  return data && typeof data === 'object' ? data : {};
}

function writeJson(data) {
  try {
    kvfile.writeJson(CONFIG_FILE, data, { mode: 0o600 });
  } catch (e) {
    throw new Error('通知配置写入失败：' + (e.message || e));
  }
}

function str(value, fallback, max) {
  if (value === undefined) return fallback;
  return String(value == null ? '' : value).trim().slice(0, max);
}

function normalizeMail(src) {
  const item = src && typeof src === 'object' ? src : {};
  const port = Number(item.port);
  return {
    enabled: item.enabled === undefined ? false : !!item.enabled,
    host: str(item.host, process.env.SMTP_HOST || '', LIMITS.host),
    port: Number.isFinite(port) && port > 0 && port < 65536 ? port : Number(process.env.SMTP_PORT) || 465,
    secure: item.secure === undefined ? (Number(item.port || process.env.SMTP_PORT || 465) === 465) : !!item.secure,
    user: str(item.user, process.env.SMTP_USER || '', LIMITS.user),
    pass: str(item.pass, process.env.SMTP_PASS || '', LIMITS.pass),
    from: str(item.from, process.env.SMTP_FROM || '', LIMITS.from),
    fromName: str(item.fromName, process.env.SMTP_FROM_NAME || '简单博客', LIMITS.fromName)
  };
}

function normalizeBark(src) {
  const item = src && typeof src === 'object' ? src : {};
  return {
    enabled: item.enabled === undefined ? false : !!item.enabled,
    server: str(item.server, process.env.BARK_SERVER || 'https://api.day.app', LIMITS.server).replace(/\/+$/, ''),
    key: str(item.key, process.env.BARK_KEY || '', LIMITS.key),
    group: str(item.group, process.env.BARK_GROUP || '简单博客', LIMITS.group),
    level: ['active', 'passive', 'timeSensitive', 'critical'].indexOf(item.level) >= 0 ? item.level : 'active',
    sound: str(item.sound, '', 40)
  };
}

function normalizeChannels(src) {
  const item = src && typeof src === 'object' ? src : {};
  return {
    adminMail: item.adminMail === undefined ? DEFAULT_CHANNELS.adminMail : !!item.adminMail,
    adminBark: item.adminBark === undefined ? DEFAULT_CHANNELS.adminBark : !!item.adminBark
  };
}

function normalizeTemplates(src) {
  const out = {};
  const input = src && typeof src === 'object' ? src : {};
  TEMPLATE_KEYS.forEach(function (key) {
    const def = DEFAULT_TEMPLATES[key];
    const item = input[key] && typeof input[key] === 'object' ? input[key] : {};
    if (key.indexOf('bark_') === 0) {
      out[key] = {
        title: str(item.title, def.title, LIMITS.title),
        text: str(item.text, def.text, LIMITS.text)
      };
    } else {
      out[key] = {
        subject: str(item.subject, def.subject, LIMITS.subject),
        text: str(item.text, def.text, LIMITS.text)
      };
    }
  });
  return out;
}

function getConfig() {
  const data = readJson();
  return {
    mail: normalizeMail(data.mail),
    bark: normalizeBark(data.bark),
    channels: normalizeChannels(data.channels),
    templates: normalizeTemplates(data.templates),
    updatedAt: Number(data.updatedAt) || 0
  };
}

function publicConfig() {
  const cfg = getConfig();
  const pass = cfg.mail.pass;
  return {
    mail: {
      enabled: cfg.mail.enabled,
      host: cfg.mail.host,
      port: cfg.mail.port,
      secure: cfg.mail.secure,
      user: cfg.mail.user,
      from: cfg.mail.from,
      fromName: cfg.mail.fromName,
      hasPass: !!pass,
      passMasked: pass ? String(pass).slice(0, 2) + '****' + String(pass).slice(-2) : ''
    },
    bark: { enabled: cfg.bark.enabled, server: cfg.bark.server, key: cfg.bark.key, hasKey: !!cfg.bark.key, group: cfg.bark.group },
    channels: cfg.channels,
    templates: cfg.templates,
    defaults: DEFAULT_TEMPLATES,
    templateMeta: TEMPLATE_META,
    updatedAt: cfg.updatedAt
  };
}

function saveConfig(patch) {
  const current = getConfig();
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = { mail: current.mail, bark: current.bark, channels: current.channels, templates: current.templates, updatedAt: Date.now() };

  if (p.mail && typeof p.mail === 'object') {
    const merged = Object.assign({}, current.mail, p.mail);
    if (p.mail.pass === undefined || p.mail.pass === '') merged.pass = current.mail.pass;
    next.mail = normalizeMail(merged);
  }
  if (p.bark && typeof p.bark === 'object') next.bark = normalizeBark(Object.assign({}, current.bark, p.bark));
  if (p.channels && typeof p.channels === 'object') next.channels = normalizeChannels(Object.assign({}, current.channels, p.channels));
  if (p.templates && typeof p.templates === 'object') {
    next.templates = normalizeTemplates(Object.assign({}, current.templates, p.templates));
  }
  writeJson(next);
  return { ok: true, config: publicConfig() };
}

function fill(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (all, key) {
    const value = vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
    return value;
  });
}

// 黑白邮件模板：外层深色背景 + 站点 logo/名称 + 内层浅灰正文卡片（参考大厂通知邮件）
function renderHtml(subject, text, site, opts) {
  const esc = function (v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const o = opts && typeof opts === 'object' ? opts : {};
  const siteName = esc(o.siteName || site || '');
  const avatar = esc(String(o.avatar || (o.siteName || site || '?')).slice(0, 2));
  const footUrl = o.siteUrl ? String(o.siteUrl) : '';

  const paragraphs = String(text || '').split(/\n{2,}/).map(function (block) {
    const lines = block.split('\n').map(function (line) {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^https?:\/\//i.test(trimmed)) {
        return '<p style="margin:0 0 12px"><a href="' + esc(trimmed) + '" style="color:#111213;text-decoration:underline;word-break:break-all">' + esc(trimmed) + '</a></p>';
      }
      return '<p style="margin:0 0 12px">' + esc(line) + '</p>';
    }).join('');
    return '<div style="margin:0 0 16px">' + lines + '</div>';
  }).join('');

  return [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light only">',
    '<title>' + esc(subject) + '</title></head>',
    '<body style="margin:0;padding:0;background:#0e0f11;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e0f11;">',
    '<tr><td align="center" style="padding:36px 16px 40px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">',
    // 深色区：logo + 站名
    '<tr><td style="padding:0 4px 22px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td style="width:40px;height:40px;border:1px solid #3a3d42;border-radius:12px;background:#181a1d;',
    'color:#f4f4f5;font:600 15px/40px -apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;text-align:center">' + avatar + '</td>',
    '<td style="padding-left:12px;color:#f4f4f5;font:600 15px/1.3 -apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;letter-spacing:.01em">' + siteName + '</td>',
    '</tr></table></td></tr>',
    // 浅灰正文卡片
    '<tr><td style="background:#f4f4f5;border-radius:16px;padding:30px 28px;',
    'color:#1a1a1c;font:14px/1.75 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">',
    '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8f;margin-bottom:10px">通知</div>',
    '<h1 style="margin:0 0 20px;font-size:19px;line-height:1.5;font-weight:600;color:#111113">' + esc(subject) + '</h1>',
    '<div style="height:1px;background:#e2e2e4;margin:0 0 20px"></div>',
    paragraphs,
    '<div style="height:1px;background:#e2e2e4;margin:24px 0 16px"></div>',
    '<div style="font-size:12px;color:#8a8a8f;line-height:1.8">',
    '这封邮件由 ' + siteName + ' 自动发送，请勿直接回复。',
    footUrl ? '<br><a href="' + esc(footUrl) + '" style="color:#8a8a8f;text-decoration:underline">' + esc(footUrl.replace(/^https?:\/\//, '')) + '</a>' : '',
    '</div></td></tr>',
    '<tr><td style="padding:18px 6px 0;color:#5b5e63;font:11px/1.7 -apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;text-align:center">',
    '© ' + new Date().getFullYear() + ' ' + siteName + ' · All Rights Reserved.',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}

// 站点外观（邮件里的 logo 字与站名），失败不影响发送
function siteLook(siteUrl) {
  try {
    const site = require('./site');
    const info = site.getSite();
    return {
      siteName: info && info.name ? String(info.name) : undefined,
      avatar: info && info.avatarText ? String(info.avatarText) : undefined,
      siteUrl: siteUrl
    };
  } catch (e) {
    return { siteUrl: siteUrl };
  }
}

const lastSent = new Map();

function throttled(key, windowMs) {
  const now = Date.now();
  const at = lastSent.get(key) || 0;
  if (now - at < (windowMs || 120000)) return true;
  lastSent.set(key, now);
  if (lastSent.size > 200) {
    const cutoff = now - 30 * 60 * 1000;
    lastSent.forEach(function (v, k) { if (v < cutoff) lastSent.delete(k); });
  }
  return false;
}

async function sendTemplate(templateId, to, vars) {
  const cfg = getConfig();
  if (!cfg.mail.enabled || !cfg.mail.host) return { ok: false, skipped: 'mail_disabled' };
  if (!to) return { ok: false, skipped: 'no_recipient' };
  const tpl = cfg.templates[templateId] || DEFAULT_TEMPLATES[templateId];
  if (!tpl) return { ok: false, error: '模板不存在' };
  const site = (vars && vars.site) || DEFAULT_SITE;
  const subject = fill(tpl.subject, Object.assign({ site: site }, vars));
  const text = fill(tpl.text, Object.assign({ site: site }, vars));
  try {
    await mailer.sendMail(cfg.mail, { to: to, subject: subject, text: text, html: renderHtml(subject, text, site, siteLook(site)) });
    return { ok: true };
  } catch (e) {
    console.warn('[notify] 邮件发送失败：', e && e.message);
    return { ok: false, error: mailer.friendlyError(e) };
  }
}

async function bark(templateId, vars) {
  const cfg = getConfig();
  if (!cfg.bark.enabled || !cfg.bark.key) return { ok: false, skipped: 'bark_disabled' };
  const tpl = cfg.templates[templateId] || DEFAULT_TEMPLATES[templateId];
  if (!tpl) return { ok: false, error: '模板不存在' };
  const site = (vars && vars.site) || DEFAULT_SITE;
  const merged = Object.assign({ site: site }, vars);
  const body = fill(tpl.text, merged).trim().slice(0, 1500);
  const title = fill(tpl.title || '', merged).trim().slice(0, 120) || '通知';
  const tap = String((vars && vars.link) || '').trim();

  const url = cfg.bark.server.replace(/\/+$/, '') + '/push';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_key: cfg.bark.key,
        title: title,
        body: body,
        group: cfg.bark.group || undefined,
        level: cfg.bark.level || 'active',
        sound: cfg.bark.sound || undefined,
        url: /^https?:\/\//i.test(tap) ? tap : undefined,
        isArchive: 1
      }),
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok || (data && data.code && data.code !== 200)) {
      const raw = String((data && data.message) || '');
      let message = raw || ('推送服务返回 ' + res.status);
      if (/device token/i.test(raw)) message = '推送 Key 无效，请检查 Bark App 里的设备 Key';
      else if (/not found|404/i.test(raw)) message = '推送地址不对，请检查服务器地址（默认 https://api.day.app）';
      else if (/invalid/i.test(raw)) message = '推送参数不正确：' + raw;
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[notify] Bark 推送失败：', e && e.message);
    return { ok: false, error: /timeout|aborted/i.test(String(e && e.message)) ? '连接 Bark 服务器超时' : '连接 Bark 服务器失败' };
  }
}

// ——— 事件入口 ————————————————————————————————————————————————
// 规则：发给站外用户的通知只用邮件；发给站长的通知按「推送」页两个勾选框决定走邮件还是 Bark。

function adminMail() {
  const cfg = getConfig();
  return cfg.mail.from || cfg.mail.user || '';
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// 站长通知：按渠道开关分别发送
async function notifyAdmin(mailTpl, barkTpl, vars) {
  const cfg = getConfig();
  const jobs = [];
  if (cfg.channels.adminMail && cfg.mail.enabled) {
    const to = adminMail();
    if (to) jobs.push(sendTemplate(mailTpl, to, vars));
  }
  if (cfg.channels.adminBark && cfg.bark.enabled) {
    jobs.push(bark(barkTpl, vars));
  }
  const results = await Promise.all(jobs.map(function (job) { return job.catch(function () { return { ok: false }; }); }));
  return results;
}

// 有人新评论 -> 只通知站长（发送与否由渠道开关决定）
async function onComment(comment, post) {
  const vars = {
    site: siteLabel(),
    name: (comment && comment.author) || '访客',
    title: (post && post.title) || '文章',
    content: String((comment && comment.content) || '').slice(0, 300),
    url: DEFAULT_SITE + '/post/' + encodeURIComponent(((post && post.id) || '')),
    link: DEFAULT_SITE + '/post/' + encodeURIComponent(((post && post.id) || '')),
    time: nowText(),
    status: '待审核'
  };
  return notifyAdmin('comment_received', 'bark_comment', vars);
}

// 有人回复了某条评论 -> 发邮件给被回复的人（回复者可能是站长，也可能是其他访客）
async function onCommentReply(comment, post, replyText, replier) {
  const to = comment && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(comment.contact || '')) ? comment.contact : '';
  if (!to) return { ok: false, skipped: 'no_recipient' };
  const who = String(replier || '').trim() || '有人';
  return sendTemplate('comment_reply', to, {
    site: siteLabel(),
    siteUrl: DEFAULT_SITE,
    name: (comment && comment.author) || '访客',
    replier: who,
    title: (post && post.title) || '文章',
    content: String(replyText || '').slice(0, 600),
    url: DEFAULT_SITE + '/post/' + encodeURIComponent(((post && post.id) || '')),
    time: nowText()
  });
}

// 兼容旧签名（站长回复）
async function onAdminReply(comment, post, replyText, replier) {
  return onCommentReply(comment, post, replyText, String(replier || '').trim() || '站长');
}

// 有人申请友链 -> 通知站长
async function onLinkApply(item) {
  const vars = {
    site: siteLabel(),
    name: (item && item.name) || '',
    url: (item && item.url) || '',
    content: (item && item.icon) || '未填写',
    link: DEFAULT_SITE + '/links',
    time: nowText(),
    status: '待审核'
  };
  return notifyAdmin('link_received', 'bark_link', vars);
}

// 友链审核出结果 -> 只发邮件给申请人（申请人填了邮箱才发）
async function onLinkReview(item, status) {
  const to = item && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(item.email || '')) ? item.email : '';
  if (!to) return { ok: false, skipped: 'no_recipient' };
  const reason = String((item && item.rejectReason) || '').trim().slice(0, 120);
  return sendTemplate('link_result', to, {
    site: siteLabel(),
    name: (item && item.name) || '',
    url: (item && item.url) || '',
    status: status === 'approved' ? '已通过' : '未通过',
    reason: reason,
    reasonLine: status === 'approved' ? '' : ('未通过原因：' + (reason || '未填写原因')),
    content: (item && item.note) || '',
    time: nowText()
  });
}

// 安全提醒 -> 通知站长
async function onSecurity(title, detail) {
  const cfg = getConfig();
  if (!cfg.channels.adminMail && !cfg.channels.adminBark) return { ok: false, skipped: 'all_channels_off' };
  if (throttled('security:' + title, 5 * 60 * 1000)) return { ok: false, skipped: 'throttled' };
  const vars = {
    site: siteLabel(),
    title: title,
    content: detail,
    link: DEFAULT_SITE,
    time: nowText()
  };
  return notifyAdmin('security_alert', 'bark_security', vars);
}

async function testMail(to) {
  const cfg = getConfig();
  if (!cfg.mail.host) return { ok: false, error: '请先填写 SMTP 服务器地址' };
  const target = to || cfg.mail.from || cfg.mail.user;
  if (!target) return { ok: false, error: '请先填写发件邮箱' };
  const text = [
    '这是一封测试邮件，说明 SMTP 配置可用。',
    '',
    '服务器：' + cfg.mail.host + ':' + cfg.mail.port,
    '发件人：' + (cfg.mail.fromName ? cfg.mail.fromName + ' <' + (cfg.mail.from || cfg.mail.user) + '>' : (cfg.mail.from || cfg.mail.user)),
    '时间：' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  ].join('\n');
  try {
    await mailer.sendMail(cfg.mail, { to: target, subject: '测试邮件 · SMTP 配置可用', text: text, html: renderHtml('测试邮件 · SMTP 配置可用', text, DEFAULT_SITE, siteLook(DEFAULT_SITE)) });
    return { ok: true, message: '测试邮件已发送到 ' + target };
  } catch (e) {
    return { ok: false, error: mailer.friendlyError(e) };
  }
}

async function testBark() {
  const cfg = getConfig();
  if (!cfg.bark.key) return { ok: false, error: '请先填写 Bark 推送 Key' };
  const res = await bark('bark_security', {
    site: siteLabel(),
    title: '测试推送',
    content: '这是一条测试推送，说明 Bark 配置可用。',
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  });
  return res.ok ? { ok: true, message: '测试推送已发送，请查看手机通知' } : res;
}

module.exports = {
  CONFIG_FILE,
  TEMPLATE_KEYS,
  DEFAULT_TEMPLATES,
  getConfig,
  publicConfig,
  saveConfig,
  fill,
  renderHtml,
  sendTemplate,
  bark,
  onComment,
  onCommentReply,
  onAdminReply,
  onAdminReply,
  onLinkApply,
  onLinkReview,
  onSecurity,
  testMail,
  testBark
};

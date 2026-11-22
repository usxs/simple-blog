/**
 * backend/mailer.js — 极简 SMTP 客户端（零依赖，只用 node:net / node:tls）
 *
 * 只做发信需要的部分：EHLO / STARTTLS / AUTH LOGIN / AUTH PLAIN / MAIL FROM / RCPT TO / DATA。
 * 支持隐式 TLS（465）与 STARTTLS（587/25）。不处理附件与复杂编码，
 * 正文用 UTF-8 + base64 传输，主题用 RFC 2047 编码，中文不会乱码。
 */

const net = require('net');
const tls = require('tls');

const TIMEOUT_MS = 15000;

function b64(str) {
  return Buffer.from(String(str), 'utf8').toString('base64');
}

function encodeHeader(value) {
  const raw = String(value || '');
  if (!/[^\x20-\x7e]/.test(raw)) return raw;
  return '=?UTF-8?B?' + b64(raw) + '?=';
}

function wrap76(str) {
  const lines = [];
  for (let i = 0; i < str.length; i += 76) lines.push(str.slice(i, i + 76));
  return lines.join('\r\n');
}

function buildMessage(cfg, msg) {
  const from = cfg.from || (cfg.user || '');
  const fromLine = cfg.fromName
    ? encodeHeader(cfg.fromName) + ' <' + from + '>'
    : from;
  const subject = encodeHeader(msg.subject || '(无主题)');
  const text = String(msg.text || '');
  const html = msg.html ? String(msg.html) : '';
  const boundary = 'sp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const headers = [
    'From: ' + fromLine,
    'To: ' + (msg.to || ''),
    'Subject: ' + subject,
    'MIME-Version: 1.0',
    'Date: ' + new Date().toUTCString(),
    'Message-ID: <' + Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 10) + '@' + (from.split('@')[1] || 'localhost') + '>'
  ];

  if (html) {
    headers.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
    const body = [
      '--' + boundary,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64(text)),
      '--' + boundary,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64(html)),
      '--' + boundary + '--',
      ''
    ].join('\r\n');
    return headers.join('\r\n') + '\r\n\r\n' + body;
  }

  headers.push('Content-Type: text/plain; charset=UTF-8');
  headers.push('Content-Transfer-Encoding: base64');
  return headers.join('\r\n') + '\r\n\r\n' + wrap76(b64(text));
}

function sendMail(cfg, msg) {
  return new Promise(function (resolve, reject) {
    if (!cfg || !cfg.host) return reject(new Error('没有填写 SMTP 服务器地址'));
    if (!msg || !msg.to) return reject(new Error('没有收件人'));
    const port = Number(cfg.port) || (cfg.secure ? 465 : 587);
    const host = String(cfg.host).trim();
    const message = buildMessage(cfg, msg);

    let socket = null;
    let settled = false;
    let buffer = '';
    let pending = null;

    function finish(err) {
      if (settled) return;
      settled = true;
      try { socket && socket.destroy(); } catch (e) {}
      if (err) reject(err); else resolve({ ok: true });
    }

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (/^\d{3}-/.test(line)) continue;
        const code = parseInt(line.slice(0, 3), 10);
        const text = line.slice(4);
        if (pending) {
          const cb = pending;
          pending = null;
          try { cb(code, text); } catch (e) { finish(e); }
        }
      }
    }

    function waitFor(okCodes) {
      return new Promise(function (res, rej) {
        pending = function (code, text) {
          if (okCodes.indexOf(code) !== -1) res({ code: code, text: text });
          else rej(new Error('发送失败：' + code + ' ' + (text || '')));
        };
      });
    }

    function withTimeout(promise) {
      return Promise.race([promise, new Promise(function (_, rej) {
        setTimeout(function () { if (!settled) rej(new Error('连接 SMTP 服务器超时')); }, TIMEOUT_MS);
      })]);
    }

    function cmd(line, okCodes) {
      const p = waitFor(okCodes);
      socket.write(line + '\r\n');
      return withTimeout(p);
    }

    function attach(sock) {
      socket = sock;
      socket.setEncoding('utf8');
      socket.setTimeout(TIMEOUT_MS, function () { if (!settled) finish(new Error('连接 SMTP 服务器超时')); });
      socket.on('data', onData);
      socket.on('error', function (e) { finish(e); });
      socket.on('close', function () { if (!settled) finish(new Error('SMTP 连接被服务器关闭')); });
    }

    function open() {
      if (cfg.secure) attach(tls.connect({ host: host, port: port, rejectUnauthorized: false }));
      else attach(net.connect({ host: host, port: port }));
    }

    open();

    (async function () {
      await withTimeout(waitFor([220]));
      let ehlo = await cmd('EHLO star-space', [250]);
      let featureText = String(ehlo.text || '');

      if (!cfg.secure && /STARTTLS/i.test(featureText)) {
        await cmd('STARTTLS', [220]);
        const plain = socket;
        plain.removeAllListeners('data');
        const secureSocket = tls.connect({ socket: plain, servername: host, rejectUnauthorized: false });
        attach(secureSocket);
        await new Promise(function (res, rej) {
          secureSocket.once('secureConnect', res);
          secureSocket.once('error', rej);
        });
        ehlo = await cmd('EHLO star-space', [250]);
        featureText = String(ehlo.text || '');
      }

      const user = String(cfg.user || '');
      const pass = String(cfg.pass || '');
      if (user && pass) {
        const plainSupported = /AUTH[^\n]*PLAIN/i.test(featureText);
        const loginSupported = /AUTH[^\n]*LOGIN/i.test(featureText);
        if (plainSupported && !loginSupported) {
          await cmd('AUTH PLAIN ' + b64('\u0000' + user + '\u0000' + pass), [235]);
        } else {
          await cmd('AUTH LOGIN', [334]);
          await cmd(b64(user), [334]);
          await cmd(b64(pass), [235]);
        }
      }

      const from = String(cfg.from || cfg.user || '');
      await cmd('MAIL FROM:<' + from + '>', [250]);
      await cmd('RCPT TO:<' + msg.to + '>', [250, 251]);
      await cmd('DATA', [354]);
      const dataPromise = waitFor([250]);
      socket.write(message + '\r\n.\r\n');
      await withTimeout(dataPromise);
      try { await cmd('QUIT', [221]); } catch (e) {}
      finish(null);
    })().catch(finish);
  });
}

function friendlyError(err) {
  const text = String((err && err.message) || err || '');
  if (/ENOTFOUND|EAI_AGAIN/.test(text)) return '找不到这个 SMTP 服务器，请检查服务器地址';
  if (/ECONNREFUSED/.test(text)) return '服务器拒绝连接，请检查端口是否开放';
  if (/ETIMEDOUT|超时/.test(text)) return '连接 SMTP 服务器超时，请检查地址和端口';
  if (/535|534|530|Authentication|auth/i.test(text)) return '邮箱账号或密码不正确，或被服务商拒绝';
  if (/CERT|self signed|SSL|TLS/i.test(text)) return 'TLS 握手失败，请检查端口与加密方式是否匹配';
  return text || '发送失败';
}

module.exports = { sendMail, buildMessage, friendlyError };

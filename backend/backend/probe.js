const http = require('http');
const https = require('https');
const { getConfig, saveConfig } = require('./storage');

function probeSingleUrl(targetUrl, expectedCode, timeoutMs) {
  const expect = Number(expectedCode) || 200;
  const timeout = timeoutMs || 8000;
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(
        parsed,
        {
          method: 'GET',
          timeout: timeout,
          headers: { 'User-Agent': 'simple-blog-monitor/1.0' },
          rejectUnauthorized: false
        },
        (res) => {
          const latencyMs = Date.now() - start;
          res.resume();
          const code = res.statusCode || 0;
          resolve({ ok: code === expect, statusCode: code, latencyMs: latencyMs });
        }
      );
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, statusCode: 0, latencyMs: timeout }); });
      req.on('error', () => { resolve({ ok: false, statusCode: 0, latencyMs: Date.now() - start }); });
      req.end();
    } catch (e) {
      resolve({ ok: false, statusCode: 0, latencyMs: 0 });
    }
  });
}

async function runAllProbes() {
  const cfg = getConfig();
  if (!Array.isArray(cfg.status) || !cfg.status.length) return;
  for (let i = 0; i < cfg.status.length; i++) {
    const item = cfg.status[i];
    if (!item.url) continue;
    const result = await probeSingleUrl(item.url, Number(item.expectedCode || 200), 8000);
    if (!Array.isArray(item.history)) item.history = [];
    const state = !result.ok ? 'down' : (result.latencyMs > 1000 ? 'warn' : 'up');
    item.history.push({ t: Date.now(), ok: result.ok, code: result.statusCode, ms: result.latencyMs, state: state });
    if (item.history.length > 45) item.history = item.history.slice(-45);
    const okCount = item.history.filter(h => h.ok).length;
    item.ok = result.ok;
    item.statusCode = result.statusCode;
    item.latency = result.ok ? (result.latencyMs + ' ms') : 'TIMEOUT / ERR';
    item.uptime = ((okCount / item.history.length) * 100).toFixed(1) + '%';
    item.lastChecked = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  saveConfig(cfg);
}

function startProbeScheduler() {
  runAllProbes();
  setInterval(runAllProbes, 60 * 1000);
}

module.exports = {
  runAllProbes,
  startProbeScheduler
};
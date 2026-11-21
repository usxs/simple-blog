/**
 * backend/probe-source.js — 「探针」页的数据来源适配层
 *
 * 支持两种数据源，统一成同一种服务器结构返回给前端，换探针不用改前端：
 *   cf      CF-Server-Monitor（GET <url>/api/servers）
 *   minimal 极简探针 monitor（GET <url>/api/nodes，未登录时只返回公开节点）
 *
 * 统一结构：
 *   { id, name, region, group, online, cpu, load,
 *     memUsed, memTotal, diskUsed, diskTotal, netIn, netOut,
 *     pings: [{ label, ms }], lastUpdated, uptime }
 * 容量单位统一为 MB，速率单位为 B/s。
 */

const http = require('http');
const https = require('https');

const PROVIDER_LABELS = { cf: 'CF-Server-Monitor', minimal: '极简探针' };
const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
// 上报超过这个时间就当作离线（两种探针都适用）
const OFFLINE_AFTER_MS = 5 * 60 * 1000;

function fetchJson(targetUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('探针地址无效'));
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reject(new Error('探针地址必须是 http(s)'));
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      parsed,
      {
        method: 'GET',
        timeout: timeoutMs || TIMEOUT_MS,
        headers: { 'User-Agent': 'simple-blog-probe/1.0', Accept: 'application/json' },
        rejectUnauthorized: false
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > MAX_BYTES) {
            req.destroy(new Error('探针响应过大'));
          }
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error('探针接口返回 HTTP ' + res.statusCode));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('探针接口返回的不是 JSON'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('探针接口超时')));
    req.on('error', (e) => reject(e));
    req.end();
  });
}

/** 数值容错：非数字一律当 0 */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 容量换算：
 *   CF-Server-Monitor 的 ram_total / disk_total 直接是 MB；
 *   极简探针的 agent（src/collect.rs）按字节上报（kb * 1024）。
 * 小的数值（< 1e6）按 MB 处理，避免把 MB 再除一次。
 */
function toMb(value) {
  const n = num(value);
  if (n <= 0) return 0;
  return n < 1024 * 1024 ? Math.round(n) : Math.round(n / (1024 * 1024));
}

function cfServerToModel(server) {
  const lastUpdated = num(server.last_updated);
  const age = Date.now() - lastUpdated;
  const hasFlag = server.is_online !== undefined && server.is_online !== null && server.is_online !== '';
  const online = hasFlag
    ? server.is_online === true || server.is_online === 1 || server.is_online === '1'
    : lastUpdated > 0 && age >= -60 * 1000 && age <= OFFLINE_AFTER_MS;

  const pings = [];
  [['电信', server.ping_ct], ['联通', server.ping_cu], ['移动', server.ping_cm], ['BGP', server.ping_bd]]
    .forEach(([label, ms]) => {
      const v = Number(ms);
      if (Number.isFinite(v) && v >= 0) pings.push({ label, ms: Math.round(v) });
    });

  return {
    id: String(server.id || ''),
    name: String(server.name || '未命名服务器'),
    region: String(server.region || server.server_group || ''),
    group: String(server.server_group || ''),
    online,
    cpu: num(server.cpu),
    load: 0,
    memUsed: num(server.ram_used),
    memTotal: num(server.ram_total),
    diskUsed: num(server.disk_used),
    diskTotal: num(server.disk_total),
    netIn: num(server.net_in_speed),
    netOut: num(server.net_out_speed),
    pings,
    lastUpdated: lastUpdated || 0,
    uptime: num(server.uptime)
  };
}

function minimalNodeToModel(node) {
  const metrics = node && node.metrics && typeof node.metrics === 'object' ? node.metrics : {};
  const online = !!node.online;
  const lastSeenSec = num(node.last_seen);
  const loadArr = Array.isArray(metrics.load) ? metrics.load : [];
  return {
    id: String(node.id || ''),
    name: String(node.name || '未命名服务器'),
    region: String(node.country || ''),
    group: String(node.group || ''),
    online,
    cpu: num(metrics.cpu),
    load: num(loadArr[0]),
    memUsed: toMb(metrics.mem_used),
    memTotal: toMb(metrics.mem_total),
    diskUsed: toMb(metrics.disk_used),
    diskTotal: toMb(metrics.disk_total),
    netIn: num(metrics.net_rx),
    netOut: num(metrics.net_tx),
    pings: [],
    lastUpdated: lastSeenSec > 0 ? lastSeenSec * 1000 : 0,
    uptime: num(metrics.uptime)
  };
}

function endpointOf(probe) {
  const base = String((probe && probe.url) || '').replace(/\/+$/, '');
  if (!base) return '';
  return base + (probe.provider === 'minimal' ? '/api/nodes' : '/api/servers');
}

/**
 * 拉取探针数据并归一化。
 * 返回 { provider, label, panelUrl, servers, stats }；失败抛错，由调用方转 502。
 */
async function fetchProbeServers(probe) {
  const provider = probe && probe.provider === 'minimal' ? 'minimal' : 'cf';
  const endpoint = endpointOf({ provider, url: probe && probe.url });
  if (!endpoint) {
    const err = new Error('未配置探针地址');
    err.code = 'NO_URL';
    throw err;
  }

  const payload = await fetchJson(endpoint);
  let servers = [];

  if (provider === 'minimal') {
    const nodes = Array.isArray(payload && payload.nodes) ? payload.nodes : null;
    if (!nodes) throw new Error('极简探针返回的数据缺少 nodes 数组');
    servers = nodes.map(minimalNodeToModel);
  } else {
    const list = Array.isArray(payload && payload.servers) ? payload.servers : null;
    if (!list) throw new Error('CF 探针返回的数据缺少 servers 数组');
    servers = list.map(cfServerToModel);
  }

  const online = servers.filter((s) => s.online).length;
  return {
    provider,
    label: PROVIDER_LABELS[provider],
    panelUrl: String((probe && probe.panelUrl) || ''),
    servers,
    stats: { total: servers.length, online, offline: servers.length - online }
  };
}

module.exports = { fetchProbeServers, fetchJson, toMb, cfServerToModel, minimalNodeToModel, PROVIDER_LABELS };

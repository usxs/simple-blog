// IndexNow 即时推送：文章发布/更新后第一时间通知 Bing、Yandex、Seznam、Naver 等支持 IndexNow
// 协议的搜索引擎（Google 不支持，走常规抓取）。fire-and-forget，任何失败都只打一行日志，
// 绝不影响保存接口的响应。
//
// 配置优先级：data/indexnow.json（后台「管理 → 搜索引擎推送」写的） > 环境变量
//   INDEXNOW_KEY=<随机 8~64 位字母数字>
//   INDEXNOW_KEY_LOCATION=https://example.com/<KEY>.txt（默认按主站域名拼出）
// 部署前端时需把与密钥同名、内容为密钥的文本文件 <INDEXNOW_KEY>.txt 放到前端根目录一起部署。
const fs = require('fs');
const path = require('path');
const { PUBLIC_SITE_URL } = require('./sitemap');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'indexnow.json');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function envConfig() {
  return {
    key: String(process.env.INDEXNOW_KEY || '').trim(),
    keyLocation: String(process.env.INDEXNOW_KEY_LOCATION || '').trim()
  };
}

function readStored() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    return {};
  }
}

// 当前生效的配置（后台可读）
function getIndexNowConfig() {
  const stored = readStored();
  const fallback = envConfig();
  const key = String(stored.key !== undefined ? stored.key : fallback.key).trim();
  const explicitLocation = String(stored.keyLocation !== undefined ? stored.keyLocation : fallback.keyLocation).trim();
  const valid = KEY_PATTERN.test(key);
  const keyLocation = valid
    ? (explicitLocation || PUBLIC_SITE_URL + '/' + key + '.txt')
    : '';
  return {
    key,
    keyLocation,
    rawKeyLocation: explicitLocation,
    valid,
    enabled: valid,
    source: stored.key !== undefined ? 'file' : (fallback.key ? 'env' : 'none'),
    fileName: valid ? key + '.txt' : ''
  };
}

// 后台保存（空字符串 = 关闭推送）
function saveIndexNowConfig(patch) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const key = String(p.key || '').trim();
  const keyLocation = String(p.keyLocation || '').trim();
  if (key && !KEY_PATTERN.test(key)) {
    return { ok: false, error: '密钥格式不正确：8–64 位字母、数字或短横线' };
  }
  if (keyLocation && !/^https?:\/\//i.test(keyLocation)) {
    return { ok: false, error: '密钥文件地址必须是 http(s) 开头的完整 URL' };
  }
  const next = { key, keyLocation, updatedAt: new Date().toISOString() };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = CONFIG_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, CONFIG_FILE);
  } catch (err) {
    return { ok: false, error: '保存失败：数据目录不可写（检查容器 data 挂载与权限）' };
  }
  return { ok: true, config: getIndexNowConfig() };
}

// 检查密钥文件是否已部署（内容需与密钥一致）
async function verifyKeyFile() {
  const cfg = getIndexNowConfig();
  if (!cfg.valid) return { ok: false, error: '还没有填写 IndexNow 密钥' };
  try {
    const res = await fetch(cfg.keyLocation, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, status: res.status, error: '密钥文件返回 HTTP ' + res.status };
    const type = String(res.headers.get('content-type') || '').toLowerCase();
    const text = (await res.text()).trim();
    if (type.indexOf('text/html') !== -1) {
      return { ok: false, status: res.status, error: '这个地址返回的是网页，密钥文件还没有部署到前端根目录' };
    }
    if (text !== cfg.key) return { ok: false, status: res.status, error: '文件内容与密钥不一致' };
    return { ok: true, status: res.status, keyLocation: cfg.keyLocation };
  } catch (err) {
    return { ok: false, error: '读取密钥文件失败：' + (err && err.message ? err.message : String(err)) };
  }
}

// urls: 字符串或字符串数组（绝对 URL）
function notifyIndexNow(urls) {
  const cfg = getIndexNowConfig();
  if (!cfg.valid) return; // 未配置密钥则整体静默跳过
  const list = (Array.isArray(urls) ? urls : [urls])
    .map(String)
    .filter(Boolean)
    .map(u => u.trim());
  if (!list.length) return;

  const payload = {
    host: PUBLIC_SITE_URL.replace(/^https?:\/\//, ''),
    key: cfg.key,
    keyLocation: cfg.keyLocation,
    urlList: list.slice(0, 10000)
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: controller.signal
  })
    .then(res => {
      if (!res.ok && res.status !== 200 && res.status !== 202) {
        console.warn('[indexnow] 推送未成功：HTTP ' + res.status);
      }
    })
    .catch(err => {
      console.warn('[indexnow] 推送失败（不影响保存）：' + (err && err.message ? err.message : err));
    })
    .finally(() => clearTimeout(timer));
}

module.exports = {
  notifyIndexNow,
  getIndexNowConfig,
  saveIndexNowConfig,
  verifyKeyFile,
  CONFIG_FILE
};

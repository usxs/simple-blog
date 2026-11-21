// IndexNow 即时推送：文章发布/更新后第一时间通知 Bing、Yandex、Seznam、Naver 等支持 IndexNow
// 协议的搜索引擎（Google 不支持，走常规抓取）。fire-and-forget，任何失败都只打一行日志，
// 绝不影响保存接口的响应。
//
// 配置（docker-compose environment，两项都配置后才启用）：
//   INDEXNOW_KEY=<随机 16~32 位十六进制>   协议验证密钥
//   INDEXNOW_KEY_LOCATION=https://example.com/<INDEXNOW_KEY>.txt  密钥文件地址（默认按主站域名拼出）
// 部署前端时需把与密钥同名且内容为密钥的文本文件 <INDEXNOW_KEY>.txt 放到前端根目录一起部署。
const { PUBLIC_SITE_URL } = require('./sitemap');

const INDEXNOW_KEY = String(process.env.INDEXNOW_KEY || '').trim();
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function keyLocation() {
  const explicit = String(process.env.INDEXNOW_KEY_LOCATION || '').trim();
  if (explicit) return explicit;
  if (!INDEXNOW_KEY) return '';
  return PUBLIC_SITE_URL + '/' + INDEXNOW_KEY + '.txt';
}

// urls: 字符串或字符串数组（绝对 URL）。内部按 IndexNow 协议分批（每批最多 10000 条，这里远小于）
function notifyIndexNow(urls) {
  if (!INDEXNOW_KEY) return; // 未配置密钥则整体静默跳过
  const list = (Array.isArray(urls) ? urls : [urls])
    .map(String)
    .filter(Boolean)
    .map(u => u.trim());
  if (!list.length) return;

  const payload = {
    host: PUBLIC_SITE_URL.replace(/^https?:\/\//, ''),
    key: INDEXNOW_KEY,
    keyLocation: keyLocation(),
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

module.exports = { notifyIndexNow, INDEXNOW_KEY };

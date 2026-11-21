// 列表页元信息注入（Cloudflare Pages Function）：/posts /moments /tools /probe /status /quirky
// 这些页面由前端 SPA 渲染交互列表（正文结构与 UI 完全不变），此函数只把每页专属的
// <title>/description/canonical/og 标签注入 index.html，让搜索引擎为每个栏目建立独立索引。
//
// 可用的 Pages 环境变量（推荐在 CF 控制台配置，也可直接改下面的 DEFAULTS）：
//   SITE_URL      站点主域名，如 https://blog.example.com
//   SITE_NAME     站点名称
//   SITE_BIO      站点简介（与 index.html 中 <meta name="description"> 保持一致）
const DEFAULTS = {
  siteUrl: 'https://example.com',
  siteName: '简单博客',
  siteBio: '这里是我的个人博客，记录技术、折腾与生活。'
};

const cfg = Object.assign({}, DEFAULTS);

function applyEnv(env) {
  const e = env || {};
  if (e.SITE_URL) cfg.siteUrl = String(e.SITE_URL).replace(/\/+$/, '');
  if (e.SITE_NAME) cfg.siteName = String(e.SITE_NAME);
  if (e.SITE_BIO) cfg.siteBio = String(e.SITE_BIO);
}

const PAGES = {
  posts:   { name: '文章',     desc: '全部文章列表：技术笔记、折腾记录与生活随笔。' },
  moments: { name: '动态',     desc: '动态与随想：日常记录、即时想法与生活片段。' },
  tools:   { name: '工具',     desc: '实用工具集：开发与运维中常用的在线小工具。' },
  probe:   { name: '探针',     desc: '服务器探针：实时查看各节点在线状态、负载与网络延迟。' },
  status:  { name: '状态',     desc: '站点状态：各服务可用性与运行状况一览。' },
  quirky:  { name: '奇思妙想', desc: '奇思妙想：一些有趣的碎片内容与脑洞记录。' }
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 把栏目元信息注入 index.html 骨架。返回 null 表示骨架不匹配（回退给 SPA 兜底）。
function buildListMetaHtml(indexHtml, pageKey) {
  const meta = PAGES[pageKey];
  if (!meta) return null;

  const title = esc(meta.name + ' · ' + cfg.siteName);
  const desc = esc(meta.desc);
  const url = cfg.siteUrl + '/' + pageKey;

  let html = indexHtml;
  // 用正则替换而非精确匹配：站点名称/域名变化时无需同步修改 index.html 里的文案
  const inject = [
    [/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>'],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, '<meta name="description" content="' + desc + '" />'],
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, '<link rel="canonical" href="' + esc(url) + '" />'],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, '<meta property="og:title" content="' + title + '" />'],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, '<meta property="og:description" content="' + desc + '" />'],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, '<meta property="og:url" content="' + esc(url) + '" />'],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:title" content="' + title + '" />'],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:description" content="' + desc + '" />']
  ];
  for (const [re, replacement] of inject) {
    if (!re.test(html)) return null;
    html = html.replace(re, () => replacement);
  }

  // 页面标题同步给前端（app.js 启动时读取 __SSR_META__，避免覆盖回站点名）
  const hydrateScript = '<script>window.__SSR_META__=' +
    JSON.stringify({ title: meta.name + ' · ' + cfg.siteName }).replace(/</g, '\\u003c') + '</script>';
  if (!html.includes('</head>')) return null;
  html = html.replace('</head>', hydrateScript + '\n</head>');

  return html;
}

export async function onRequestGet(context) {
  try {
    applyEnv(context.env);
    const page = String((context.params && context.params.page) || '');
    if (!PAGES[page]) return context.next(); // 未知栏目交给 SPA 兜底

    const assetRes = await context.env.ASSETS.fetch(new Request('https://assets.local/index.html'));
    const indexHtml = await assetRes.text();
    const html = buildListMetaHtml(indexHtml, page);
    if (!html) return context.next();

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  } catch (err) {
    return context.next(); // 任何异常都回退到 SPA 兜底，保证页面可用
  }
}

export { buildListMetaHtml, PAGES, applyEnv };

// 栏目页元信息注入：支持后台自定义路径（/moments → /diary 等）与栏目改名。
// 页面结构仍由前端 SPA 渲染（UI 不变），这里只把专属的 title/description/canonical/og 注入 index.html。
const SITE_URL = 'https://example.com';
const SITE_NAME = '简单博客';
const SITE_BIO = '记录技术、折腾与生活。';
const API_BASE = 'https://api.example.com';

const DEFAULT_MODULES = {
  posts:   { name: '文章',   route: 'posts',   desc: '全部文章列表：网络基础设施、容器化部署、系统架构与日常折腾记录。' },
  moments: { name: '碎碎念', route: 'moments', desc: '动态与随想：日常记录、即时想法与生活片段。' },
  tools:   { name: '工具',   route: 'tools',   desc: '实用工具集：开发与运维中常用的在线小工具。' },
  probe:   { name: '探针',   route: 'probe',   desc: '服务器探针：实时查看各节点在线状态、负载与网络延迟。' },
  status:  { name: '状态',   route: 'status',  desc: '站点状态：各服务可用性与运行状况一览。' },
  quirky:  { name: '奇奇怪怪', route: 'quirky', desc: '奇奇怪怪：一些有趣的碎片内容与脑洞记录。' }
};

const siteMeta = { name: SITE_NAME, bio: SITE_BIO };

function apiBase(env) {
  return String((env && env.API_BASE_URL) || API_BASE).replace(/\/+$/, '');
}

// 读取站点配置（后台可改名 / 改栏目名 / 改栏目路径），失败时用内置默认值
async function loadSite(env) {
  const site = { name: SITE_NAME, bio: SITE_BIO, url: SITE_URL, modules: null };
  try {
    const res = await fetch(apiBase(env) + '/api/site', { cf: { cacheTtl: 300, cacheEverything: true } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok && data.site) {
        if (data.site.name) site.name = String(data.site.name);
        if (data.site.subtitle) site.bio = String(data.site.subtitle);
        if (data.site.modules) site.modules = data.site.modules;
      }
    }
  } catch (e) { /* 后端不可达时用内置值 */ }
  if (env && env.SITE_NAME) site.name = String(env.SITE_NAME);
  if (env && env.SITE_BIO) site.bio = String(env.SITE_BIO);
  if (env && env.SITE_URL) site.url = String(env.SITE_URL).replace(/\/+$/, '');
  siteMeta.name = site.name;
  siteMeta.bio = site.bio;
  return site;
}

// 路径段 → 栏目标识：先按自定义路径，再兼容默认路径（老链接仍可访问）
function moduleByPath(site, seg) {
  const cfg = (site && site.modules) || {};
  for (const key of Object.keys(DEFAULT_MODULES)) {
    const route = String((cfg[key] && cfg[key].route) || DEFAULT_MODULES[key].route).replace(/^\/+|\/+$/g, '');
    if (route === seg) {
      return {
        key,
        name: String((cfg[key] && cfg[key].name) || DEFAULT_MODULES[key].name),
        route,
        enabled: cfg[key] ? cfg[key].enabled !== false : true,
        desc: DEFAULT_MODULES[key].desc
      };
    }
  }
  if (DEFAULT_MODULES[seg]) {
    const def = DEFAULT_MODULES[seg];
    return {
      key: seg,
      name: String((cfg[seg] && cfg[seg].name) || def.name),
      route: seg,
      enabled: cfg[seg] ? cfg[seg].enabled !== false : true,
      desc: def.desc
    };
  }
  return null;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 用正则替换而不是精确 needle：站点名 / 副标题被后台改过也不会失配
function replaceTag(html, re, replacement) {
  if (!re.test(html)) return null;
  return html.replace(re, () => replacement);
}

function buildListMetaHtml(indexHtml, mod, site) {
  if (!mod) return null;
  const title = esc(mod.name + ' · ' + site.name);
  const desc = esc(mod.desc);
  const url = (site.url || SITE_URL).replace(/\/+$/, '') + '/' + mod.route;

  const steps = [
    [/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>'],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, '<meta name="description" content="' + desc + '" />'],
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, '<link rel="canonical" href="' + url + '" />'],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, '<meta property="og:title" content="' + title + '" />'],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, '<meta property="og:description" content="' + desc + '" />'],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, '<meta property="og:url" content="' + url + '" />'],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:title" content="' + title + '" />'],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:description" content="' + desc + '" />']
  ];

  let html = indexHtml;
  for (const [re, replacement] of steps) {
    const next = replaceTag(html, re, replacement);
    if (next === null) return null;
    html = next;
  }

  const metaTitle = mod.name + ' · ' + site.name;
  const hydrateScript = '<script>window.__SSR_META__=' +
    JSON.stringify({ title: metaTitle }).replace(/</g, '\\u003c') + '</script>';
  if (!html.includes('</head>')) return null;
  html = html.replace('</head>', hydrateScript + '\n</head>');
  return html;
}

export async function onRequestGet(context) {
  try {
    const seg = String((context.params && context.params.page) || '').replace(/^\/+|\/+$/g, '');
    if (!seg) return context.next();
    const site = await loadSite(context.env);
    const mod = moduleByPath(site, seg);
    if (!mod || !mod.enabled) return context.next(); // 未知或已关闭的栏目交给 SPA 兜底

    const assetRes = await context.env.ASSETS.fetch(new Request('https://assets.local/index.html'));
    const indexHtml = await assetRes.text();
    const html = buildListMetaHtml(indexHtml, mod, site);
    if (!html) return context.next();

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  } catch (err) {
    return context.next();
  }
}

export { buildListMetaHtml, moduleByPath, DEFAULT_MODULES };

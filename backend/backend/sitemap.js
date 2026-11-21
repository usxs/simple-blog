// sitemap 生成器：每次请求时从磁盘实时构建，文章发布/删除后立即生效（无需手动更新）。
// 只包含前端主站（Cloudflare Pages）的可抓取地址，后端管理后台与 API 一律不列入。
// 前端为 history 真实路径路由（/posts、/post/<id>），并由 CF Pages Functions 提供服务端渲染，
// 每个地址都能返回含正文的真实 HTML，Google / Bing 等引擎可直接收录。
const { readArticles } = require('./storage');
const { getSite } = require('./site');

// 前端主站地址（sitemap 中 <loc> 的前缀），可用环境变量 SITE_PUBLIC_URL 覆盖
const PUBLIC_SITE_URL = String(process.env.SITE_PUBLIC_URL || 'https://example.com')
  .trim()
  .replace(/\/+$/, '');

const CN_TZ_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});

// W3C Datetime（YYYY-MM-DD，北京时间），用于 <lastmod>
function lastmodOf(ms) {
  const n = Number(ms);
  const d = n > 0 ? new Date(n) : new Date();
  return CN_TZ_FMT.format(d);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 固定页面：导航可达的前端视图（history 真实路径）。
// 栏目路径与开关来自站点配置（后台「管理 → 前台栏目」可改名 / 改路径 / 关闭），这里实时读取。
const PAGE_META = {
  posts:   { changefreq: 'daily', priority: '0.9' },
  moments: { changefreq: 'daily', priority: '0.7' },
  tools:   { changefreq: 'weekly', priority: '0.6' },
  probe:   { changefreq: 'hourly', priority: '0.4' },
  status:  { changefreq: 'hourly', priority: '0.4' },
  quirky:  { changefreq: 'weekly', priority: '0.5' }
};

function staticPages() {
  const pages = [{ path: '/', changefreq: 'daily', priority: '1.0' }];
  let modules = {};
  try { modules = getSite().modules || {}; } catch (e) { modules = {}; }
  Object.keys(PAGE_META).forEach((key) => {
    const mod = modules[key] || {};
    if (mod.enabled === false) return;                     // 后台关闭的栏目不进 sitemap
    const route = String(mod.route || key).replace(/^\/+|\/+$/g, '') || key;
    pages.push({ path: '/' + route, changefreq: PAGE_META[key].changefreq, priority: PAGE_META[key].priority });
  });
  return pages;
}

function buildSitemap() {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];

  const now = Date.now();
  for (const p of staticPages()) {
    lines.push('  <url>');
    lines.push(`    <loc>${esc(PUBLIC_SITE_URL + p.path)}</loc>`);
    lines.push(`    <lastmod>${lastmodOf(now)}</lastmod>`);
    lines.push(`    <changefreq>${p.changefreq}</changefreq>`);
    lines.push(`    <priority>${p.priority}</priority>`);
    lines.push('  </url>');
  }

  // 文章详情页：以文章 mtime 为 lastmod，搜索引擎可据此增量抓取
  let posts = [];
  try {
    posts = readArticles() || [];
  } catch (err) {
    posts = []; // 文章目录异常时仍输出固定页面
  }
  for (const post of posts) {
    if (!post || !post.id) continue;
    lines.push('  <url>');
    lines.push(`    <loc>${esc(PUBLIC_SITE_URL + '/post/' + encodeURIComponent(String(post.id)))}</loc>`);
    lines.push(`    <lastmod>${lastmodOf(post.mtime)}</lastmod>`);
    lines.push('    <changefreq>monthly</changefreq>');
    lines.push('    <priority>0.8</priority>');
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n');
}

module.exports = { buildSitemap, PUBLIC_SITE_URL };

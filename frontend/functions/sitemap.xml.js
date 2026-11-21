// Cloudflare Pages Function：把主域名 /sitemap.xml 实时代理到后端动态 sitemap。
// 后端每次发布/删除文章后 sitemap 立即变化，这里加 5 分钟边缘缓存减轻后端压力。
//
// 可用环境变量：API_BASE_URL（后端域名）、SITE_URL（站点主域名）
const DEFAULTS = {
  apiBase: 'https://api.example.com',
  siteUrl: 'https://example.com'
};

export async function onRequest(context) {
  const env = (context && context.env) || {};
  const apiBase = String(env.API_BASE_URL || DEFAULTS.apiBase).replace(/\/+$/, '');
  const siteUrl = String(env.SITE_URL || DEFAULTS.siteUrl).replace(/\/+$/, '');

  try {
    const upstream = await fetch(apiBase + '/sitemap.xml', {
      headers: { 'User-Agent': 'simple-blog-pages-proxy' },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (e) {
    // 后端暂时不可达时兜底：至少保证主域名返回合法 sitemap
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>' + siteUrl + '/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n' +
      '</urlset>';
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}

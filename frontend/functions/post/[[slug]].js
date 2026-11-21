// 文章页服务端渲染（SSR，Cloudflare Pages Function）：/post/<id> 返回含正文的完整 HTML，Google/Bing 可直接收录。
// 渲染结果与前端 SPA 的 renderPost 使用同一套 class 与同一个 markdown 渲染器，视觉完全一致；
// 页面加载后由前端 app.js 依据 window.__PRERENDERED_POST__ 水合（评论等交互仍由前端接管）。
//
// 可用的 Pages 环境变量（推荐在 CF 控制台配置，也可直接改下面的 DEFAULTS）：
//   SITE_URL      站点主域名，如 https://blog.example.com
//   API_BASE_URL  后端 API 域名，如 https://api.example.com
//   SITE_NAME     站点名称
//   SITE_BIO      站点简介
import { renderMarkdown } from '../_markdown.js';

const DEFAULTS = {
  siteUrl: 'https://example.com',
  apiBase: 'https://api.example.com',
  siteName: '简单博客',
  siteBio: '这里是我的个人博客，记录技术、折腾与生活。'
};

const cfg = Object.assign({}, DEFAULTS);

function applyEnv(env) {
  const e = env || {};
  if (e.SITE_URL) cfg.siteUrl = String(e.SITE_URL).replace(/\/+$/, '');
  if (e.API_BASE_URL) cfg.apiBase = String(e.API_BASE_URL).replace(/\/+$/, '');
  if (e.SITE_NAME) cfg.siteName = String(e.SITE_NAME);
  if (e.SITE_BIO) cfg.siteBio = String(e.SITE_BIO);
}

// 读取后端 /api/site（后台「管理」页可改站点名/简介），失败时保持默认值
async function applyRemoteSite(env) {
  const e = env || {};
  try {
    const res = await fetch(cfg.apiBase + '/api/site', { cf: { cacheTtl: 300, cacheEverything: true } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok && data.site) {
        if (data.site.name) cfg.siteName = String(data.site.name);
        if (data.site.subtitle) cfg.siteBio = String(data.site.subtitle);
      }
    }
  } catch (err) { /* 后端不可达时用内置默认值 */ }
  if (e.SITE_NAME) cfg.siteName = String(e.SITE_NAME);
  if (e.SITE_BIO) cfg.siteBio = String(e.SITE_BIO);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 内嵌 <script> 的 JSON 需转义 "<"，防止内容中出现 </script> 提前闭合
function jsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// markdown → 纯文本摘要（去代码块/图片/链接语法/标题符号）
function mdToText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastmodOf(ms) {
  try {
    const n = Number(ms);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(n > 0 ? n : Date.now()));
  } catch (e) {
    return '';
  }
}

// 与前端 app.js renderPost 模板保持一致的评论区块骨架（评论区交互由前端水合后接管）
const COMMENTS_SECTION_HTML =
  '<section class="comments-section">' +
    '<div class="comments-head">' +
      '<h2 class="comments-title">评论区</h2>' +
      '<span class="comments-note">支持回复任意评论 · 经后台审核通过后显示</span>' +
    '</div>' +
    '<div class="comment-form" id="comment-form-box">' +
      '<div class="replying-banner" id="replying-banner" data-active="false">' +
        '<span>正在回复 <strong id="replying-target-name"></strong> 的评论</span>' +
        '<button type="button" class="replying-cancel-btn" onclick="commentBox.cancelReply()">✕ 取消回复</button>' +
      '</div>' +
      '<div class="comment-form-row">' +
        '<input class="comment-input" id="comment-author" type="text" maxlength="32" placeholder="您的昵称 *" />' +
        '<input class="comment-input" id="comment-contact" type="text" maxlength="80" placeholder="邮箱或个人网站 (选填，不公开)" />' +
      '</div>' +
      '<input type="text" id="comment-hp" style="display:none;" tabindex="-1" autocomplete="off" />' +
      '<textarea class="comment-textarea" id="comment-content" maxlength="1000" placeholder="写下您的想法... *"></textarea>' +
      '<div class="comment-submit-row">' +
        '<div class="captcha-box">' +
          '<span>验证：</span>' +
          '<span class="captcha-question" id="captcha-question" title="点击更换题目" onclick="commentBox.refreshCaptcha()">加载中...</span>' +
          '<input class="captcha-input" id="captcha-answer" type="text" maxlength="6" placeholder="答案" />' +
        '</div>' +
        '<button type="button" class="comment-submit-btn" id="comment-submit-btn" onclick="commentBox.submit()">发送评论</button>' +
      '</div>' +
      '<div class="comment-feedback" id="comment-feedback"></div>' +
    '</div>' +
    '<ul class="comment-list" id="comment-list"></ul>' +
  '</section>';

function buildArticleInnerHtml(post) {
  return (
    '<article class="article-reader">' +
      '<button class="back-btn" onclick="router.go(\'posts\')">← 返回文章列表</button>' +
      '<h1 class="reader-title">' + esc(post.title) + '</h1>' +
      '<div class="reader-meta">' + esc(post.date || '') + '</div>' +
      '<div class="reader-content">' + renderMarkdown(post.content) + '</div>' +
      '<footer class="article-license">' +
        '本文采用 <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT License</a> 授权发布 · 转载请注明出处' +
      '</footer>' +
      COMMENTS_SECTION_HTML +
    '</article>'
  );
}

// 把文章内容与元信息注入 index.html 骨架。返回 null 表示骨架不匹配（回退给 SPA 兜底）。
// 全部使用正则注入：站点名称/域名不同、或 index.html 文案被改写时依然可用。
function buildArticleHtml(indexHtml, post, postUrl) {
  const title = esc(post.title) + ' · ' + esc(cfg.siteName);
  const desc = esc(mdToText(post.content).slice(0, 110));
  const innerHtml = buildArticleInnerHtml(post);

  const blogPosting = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: String(post.title || ''),
    datePublished: String(post.date || ''),
    dateModified: lastmodOf(post.mtime),
    author: { '@type': 'Person', name: cfg.siteName },
    mainEntityOfPage: postUrl,
    inLanguage: 'zh-CN'
  }).replace(/</g, '\\u003c');

  let html = indexHtml;
  const inject = [
    [/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>'],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, '<meta name="description" content="' + desc + '" />'],
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, '<link rel="canonical" href="' + esc(postUrl) + '" />'],
    [/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/, '<meta property="og:type" content="article" />'],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, '<meta property="og:title" content="' + title + '" />'],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, '<meta property="og:description" content="' + desc + '" />'],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, '<meta property="og:url" content="' + esc(postUrl) + '" />'],
    [/<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/, '<meta property="og:site_name" content="' + esc(cfg.siteName) + '" />'],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:title" content="' + title + '" />'],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:description" content="' + desc + '" />'],
    // 首页的 WebSite 结构化数据替换为文章级 BlogPosting
    [/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">' + blogPosting + '</script>']
  ];
  for (const [re, replacement] of inject) {
    if (!re.test(html)) return null;
    html = html.replace(re, () => replacement);
  }

  // 水合标记与页面标题（app.js 启动时读取，避免覆盖 SSR 标题）
  const hydrateScript = '<script>window.__SSR_META__=' + jsonForScript({ title: title }) + ';' +
    'window.__PRERENDERED_POST__=' + jsonForScript({ id: String(post.id || ''), title: String(post.title || '') }) + '</script>';
  if (!html.includes('</head>')) return null;
  html = html.replace('</head>', hydrateScript + '\n</head>');

  // 正文注入 #page-content（与 SPA 渲染容器一致，并直接带上阅读态 class）
  const containerRe = /<main\s+id="page-content"[^>]*>\s*<\/main>/;
  if (!containerRe.test(html)) return null;
  html = html.replace(containerRe, '<main id="page-content" tabindex="-1" class="is-reading">' + innerHtml + '</main>');

  return html;
}

export async function onRequestGet(context) {
  try {
    applyEnv(context.env);
    await applyRemoteSite(context.env);
    const segs = Array.isArray(context.params.slug) ? context.params.slug : [context.params.slug];
    const rawId = segs.map(s => decodeURIComponent(String(s))).join('/');

    const apiRes = await fetch(cfg.apiBase + '/api/public/post/' + encodeURIComponent(rawId), {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!apiRes.ok) return context.next();
    const data = await apiRes.json();
    const post = data && data.post;
    if (!post || !post.id || !post.title) return context.next();
    const postUrl = cfg.siteUrl + '/post/' + encodeURIComponent(String(post.id));

    const assetRes = await context.env.ASSETS.fetch(new Request('https://assets.local/index.html'));
    const indexHtml = await assetRes.text();
    const html = buildArticleHtml(indexHtml, post, postUrl);
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

export { buildArticleHtml, applyEnv };

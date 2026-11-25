/**
 * web/ssr.js — 服务端渲染（V3 单体版）
 *
 * V1/V2 里这一步是 Cloudflare Pages Functions 干的（frontend/functions/post/[[slug]].js、
 * functions/[page].js）。前后端不分离之后没有边缘环境了，同一份逻辑挪到这里，
 * 由 Node 进程在读库的同时把 HTML 拼出来：
 *
 *   · /post/<id>   注入 title / description / canonical / og / BlogPosting 与**完整正文**
 *   · /<栏目路径>  注入该栏目的 title / description / canonical（正文仍由前端 SPA 渲染）
 *   · /            原样返回骨架（SPA 首屏）
 *
 * 渲染出来的 class 与前端 renderPost 完全一致，浏览器拿到的就是最终页面；
 * app.js 看到 window.__PRERENDERED_POST__ 后直接水合，不会再重排一次。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const storage = require('../backend/storage');
const site = require('../backend/site');

const WEB_DIR = __dirname;
const INDEX_FILE = path.join(WEB_DIR, 'index.html');

const DEFAULT_MODULES = {
  posts: { name: '文章', route: 'posts', desc: '全部文章列表：网络基础设施、容器化部署、系统架构与日常折腾记录。' },
  links: { name: '友链', route: 'links', desc: '友链：期待与你相遇，这里收藏了一些认真维护的小站。' },
  moments: { name: '瞬间', route: 'moment', desc: '动态与随想：日常记录、即时想法与生活片段。' },
  tools: { name: '工具', route: 'tools', desc: '实用工具集：开发与运维中常用的在线小工具。' },
  probe: { name: '探针', route: 'probe', desc: '服务器探针：实时查看各节点在线状态、负载与网络延迟。' },
  status: { name: '状态', route: 'status', desc: '站点状态：各服务可用性与运行状况一览。' },
  quirky: { name: '奇奇怪怪', route: 'quirky', desc: '奇奇怪怪：一些有趣的碎片内容与脑洞记录。' }
};

// ---------- 渲染器：复用浏览器的 markdown.js（与前端同一个实现） ----------

let cachedRenderer = null;

function renderMarkdown(src) {
  if (!cachedRenderer) {
    // markdown.js 由前后台共用（backend/markdown.js），与 server.js 的 /markdown.js 路由同一份
    const code = fs.readFileSync(path.join(__dirname, '..', 'markdown.js'), 'utf8');
    cachedRenderer = new Function(code + '\nreturn renderMarkdown;')();
  }
  return cachedRenderer(src);
}

// ---------- index.html 骨架（改动后自动重读） ----------

let cachedIndex = '';
let cachedIndexMtime = 0;

function readIndexHtml() {
  try {
    const st = fs.statSync(INDEX_FILE);
    if (st.mtimeMs !== cachedIndexMtime || !cachedIndex) {
      cachedIndex = fs.readFileSync(INDEX_FILE, 'utf8');
      cachedIndexMtime = st.mtimeMs;
    }
  } catch (e) {
    cachedIndex = '';
  }
  return cachedIndex;
}

// ---------- 小工具 ----------

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

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
    const d = new Date(n > 0 ? n : Date.now());
    const t = new Date(d.getTime() + 8 * 3600 * 1000);
    const p = (v) => String(v).padStart(2, '0');
    return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
  } catch (e) {
    return '';
  }
}

function siteInfo() {
  const cfg = site.getSite() || {};
  return {
    name: String(cfg.name || process.env.SITE_NAME || '简单博客'),
    bio: String(cfg.subtitle || process.env.SITE_SUBTITLE || '这里是我的个人博客，记录技术、折腾与生活。'),
    modules: cfg.modules || null
  };
}

function siteUrl(host) {
  const fromEnv = String(process.env.SITE_PUBLIC_URL || '').replace(/\/+$/, '');
  if (fromEnv && fromEnv !== 'https://example.com') return fromEnv;
  return 'http://' + String(host || '127.0.0.1');
}

// ---------- 文章页 ----------

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

function buildArticleHtml(indexHtml, post, postUrl, info) {
  const title = esc(post.title) + ' · ' + esc(info.name);
  const desc = esc(mdToText(post.content).slice(0, 110));
  const innerHtml = buildArticleInnerHtml(post);

  const blogPosting = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: String(post.title || ''),
    datePublished: String(post.date || ''),
    dateModified: lastmodOf(post.mtime),
    author: { '@type': 'Person', name: info.name },
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
    [/<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/, '<meta property="og:site_name" content="' + esc(info.name) + '" />'],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:title" content="' + title + '" />'],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:description" content="' + desc + '" />'],
    [/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">' + blogPosting + '</script>']
  ];
  for (const pair of inject) {
    if (!pair[0].test(html)) return null;
    html = html.replace(pair[0], () => pair[1]);
  }

  const hydrateScript = '<script>window.__SSR_META__=' + jsonForScript({ title: title }) + ';' +
    'window.__PRERENDERED_POST__=' + jsonForScript({ id: String(post.id || ''), title: String(post.title || '') }) + '</script>';
  if (html.indexOf('</head>') === -1) return null;
  html = html.replace('</head>', hydrateScript + '\n</head>');

  const containerRe = /<main\s+id="page-content"[^>]*>\s*<\/main>/;
  if (!containerRe.test(html)) return null;
  html = html.replace(containerRe, '<main id="page-content" tabindex="-1" class="is-reading">' + innerHtml + '</main>');

  return html;
}

// ---------- 栏目页（只注入元信息） ----------

function moduleByPath(info, seg) {
  const cfg = (info && info.modules) || {};
  const keys = Object.keys(DEFAULT_MODULES);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const route = String((cfg[key] && cfg[key].route) || DEFAULT_MODULES[key].route).replace(/^\/+|\/+$/g, '');
    if (route === seg) {
      return {
        key: key,
        name: String((cfg[key] && cfg[key].name) || DEFAULT_MODULES[key].name),
        route: route,
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

function buildListMetaHtml(indexHtml, mod, info, base) {
  if (!mod) return null;
  const title = esc(mod.name + ' · ' + info.name);
  const desc = esc(mod.desc);
  const url = base + '/' + mod.route;

  const steps = [
    [/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>'],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, '<meta name="description" content="' + desc + '" />'],
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, '<link rel="canonical" href="' + esc(url) + '" />'],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, '<meta property="og:title" content="' + title + '" />'],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, '<meta property="og:description" content="' + desc + '" />'],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, '<meta property="og:url" content="' + esc(url) + '" />'],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:title" content="' + title + '" />'],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, '<meta name="twitter:description" content="' + desc + '" />']
  ];

  let html = indexHtml;
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i][0].test(html)) return null;
    html = html.replace(steps[i][0], () => steps[i][1]);
  }

  const metaTitle = mod.name + ' · ' + info.name;
  const hydrateScript = '<script>window.__SSR_META__=' + jsonForScript({ title: metaTitle }) + '</script>';
  if (html.indexOf('</head>') === -1) return null;
  return html.replace('</head>', hydrateScript + '\n</head>');
}

// ---------- 对外入口 ----------

function findPost(id) {
  const posts = storage.readArticles();
  const want = String(id || '');
  for (let i = 0; i < posts.length; i++) {
    if (String(posts[i].id) === want) return posts[i];
  }
  return null;
}

/**
 * 渲染一个页面。
 * @param {string} pathname 请求路径（不含查询串）
 * @param {{ host?: string }} opts
 * @returns {{ status: number, html: string, cache: string } | null} null 表示交给 SPA 骨架兜底
 */
function render(pathname, opts) {
  const indexHtml = readIndexHtml();
  if (!indexHtml) return null;
  const o = opts || {};
  const info = siteInfo();
  const base = siteUrl(o.host);

  // 文章页：/post/<id>
  const postMatch = String(pathname || '').match(/^\/post\/(.+?)\/?$/);
  if (postMatch) {
    let id;
    try {
      id = decodeURIComponent(postMatch[1]);
    } catch (e) {
      id = postMatch[1];
    }
    const post = findPost(id);
    if (!post) return null;
    if (post.hidden) return null;               // 隐藏文章：SSR 不直出，交给前端拿 404
    if (post.enc) return { status: 200, html: indexHtml, cache: 'no-store' }; // 加密文章：只发骨架，正文由前端解锁
    const html = buildArticleHtml(indexHtml, post, base + '/post/' + encodeURIComponent(String(post.id)), info);
    if (!html) return null;
    // 文章状态随时可能改为隐藏/加密，不做浏览器或中间层缓存
    return { status: 200, html: html, cache: 'no-store' };
  }

  // 栏目页：/posts、/moment、/links……（含后台改过的自定义路径）
  const seg = String(pathname || '').replace(/^\/+|\/+$/g, '');
  if (seg && seg.indexOf('/') === -1 && seg.indexOf('.') === -1) {
    const mod = moduleByPath(info, seg);
    if (mod && mod.enabled) {
      const html = buildListMetaHtml(indexHtml, mod, info, base);
      if (html) return { status: 200, html: html, cache: 'public, max-age=60' };
    }
  }

  return null;
}

/** 首页 / SPA 兜底：原样返回骨架 */
function shell() {
  return readIndexHtml();
}

module.exports = {
  render: render,
  shell: shell,
  renderMarkdown: renderMarkdown,
  moduleByPath: moduleByPath,
  buildArticleHtml: buildArticleHtml,
  buildListMetaHtml: buildListMetaHtml,
  DEFAULT_MODULES: DEFAULT_MODULES
};

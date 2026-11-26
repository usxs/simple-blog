/**
 * backend/mdexport.js — 把站内文章导出成静态博客能直接吃下的 Markdown
 *
 * 每个目标都输出「front matter 字段符合该生成器习惯」的 .md，外加一份 README
 * 说明放哪个目录、还要改哪些配置。导出结果是一个 ZIP（由调用方负责打包）。
 *
 *   hugo      content/posts/<id>.md        + hugo.toml 片段
 *   hexo      source/_posts/<id>.md        + _config.yml 片段
 *   jekyll    _posts/YYYY-MM-DD-<id>.md    + README（layout: post）
 *   astro     src/content/posts/<id>.md    + src/content/config.ts 片段
 *   ghost     <id>.md + ghost-import.json  （Ghost 只认它自己的 JSON 结构）
 *   obsidian  <title>.md                   （双链/标签语法原样保留）
 *   generic   posts/<id>.md + manifest.json
 */

'use strict';

const frontmatter = require('./frontmatter');

const TARGETS = {
  hugo: { label: 'Hugo', dir: 'content/posts/' },
  hexo: { label: 'Hexo', dir: 'source/_posts/' },
  jekyll: { label: 'Jekyll', dir: '_posts/' },
  astro: { label: 'Astro', dir: 'src/content/posts/' },
  ghost: { label: 'Ghost', dir: 'content/' },
  obsidian: { label: 'Obsidian', dir: 'vault/' },
  generic: { label: '通用 Markdown', dir: 'posts/' }
};

let cachedRenderer = null;
function loadRenderer() {
  if (cachedRenderer) return cachedRenderer;
  try {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'markdown.js'), 'utf8');
    // markdown.js 是给浏览器用的全局函数脚本（没有 module.exports），
    // 包进 Function 里取出 renderMarkdown，避免污染当前模块作用域。
    const factory = new Function(src + '\nreturn renderMarkdown;');
    cachedRenderer = factory();
    return cachedRenderer;
  } catch (e) {
    cachedRenderer = (md) => '<p>' + String(md || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>';
    return cachedRenderer;
  }
}

function pad2(v) {
  const s = String(v);
  return s.length < 2 ? '0' + s : s;
}

function splitDate(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    const now = new Date();
    return {
      ymd: now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()),
      hms: '00:00:00',
      hasTime: false
    };
  }
  return {
    ymd: m[1] + '-' + m[2] + '-' + m[3],
    hms: (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00'),
    hasTime: Boolean(m[4])
  };
}

function isoOfMs(ms) {
  const n = Number(ms);
  if (!n) return '';
  const t = new Date(n + 8 * 3600 * 1000); // 统一用北京时间表示，避免导出文件随服务器时区漂移
  const pad = v => String(v).padStart(2, '0');
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()) +
    'T' + pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':' + pad(t.getUTCSeconds()) + '+08:00';
}

function isoOf(dateStr) {
  const d = splitDate(dateStr);
  return d.ymd + 'T' + d.hms + '+08:00';
}

function descriptionOf(content, max) {
  return String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 120);
}

function slugOf(post) {
  return String((post && post.id) || 'post')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-|-$/g, '') || 'post';
}

function sortedPosts(posts) {
  return (posts || []).toSorted((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function baseFields(post) {
  return {
    title: String(post.title || '未命名文章'),
    date: isoOf(post.date),
    tags: Array.isArray(post.tags) && post.tags.length ? post.tags : (post.tag ? [post.tag] : []),
    draft: Boolean(post.hidden),
    slug: slugOf(post),
    description: descriptionOf(post.content),
    locked: Boolean(post.enc),
    mtime: isoOfMs(post.mtime) || isoOf(post.date)
  };
}

// ---- 各目标的前言生成 ----

function hugoFile(post) {
  const f = baseFields(post);
  const data = {
    title: f.title,
    date: f.date,
    lastmod: f.mtime,
    draft: f.draft,
    slug: f.slug,
    description: f.description,
    tags: f.tags
  };
  return frontmatter.stringify(data) + (post.content || '');
}

function hexoFile(post) {
  const f = baseFields(post);
  const data = {
    title: f.title,
    date: f.date,
    tags: f.tags
  };
  if (f.draft) data.published = false;
  return frontmatter.stringify(data) + (post.content || '');
}

function jekyllFile(post) {
  const f = baseFields(post);
  const d = splitDate(post.date);
  const data = {
    layout: 'post',
    title: f.title,
    date: d.ymd + ' ' + d.hms + ' +0800',
    categories: post.tag ? [post.tag] : [],
    tags: f.tags
  };
  if (f.draft) data.published = false;
  return frontmatter.stringify(data) + (post.content || '');
}

function astroFile(post) {
  const f = baseFields(post);
  const data = {
    title: f.title,
    pubDate: f.date,
    description: f.description,
    tags: f.tags,
    draft: f.draft
  };
  return frontmatter.stringify(data) + (post.content || '');
}

function obsidianFile(post) {
  const f = baseFields(post);
  const data = {
    title: f.title,
    date: f.date,
    tags: f.tags
  };
  return frontmatter.stringify(data) + (post.content || '');
}

function genericFile(post) {
  const f = baseFields(post);
  const data = {
    title: f.title,
    date: f.date,
    tags: f.tags,
    draft: f.draft ? true : undefined,
    id: f.slug
  };
  return frontmatter.stringify(data) + (post.content || '');
}

function readmeFor(target, siteName, count) {
  const site = siteName || '我的博客';
  const head = '# ' + site + ' 导出（' + (TARGETS[target] || TARGETS.generic).label + '）\n\n共 ' + count + ' 篇。\n\n';
  const bodies = {
    hugo: [
      '## 用法',
      '1. 把整个 `content/` 目录复制到你的 Hugo 站点根目录（已有同目录时逐篇拷贝 `content/posts/*.md`）。',
      '2. 文章的图片链接是 `/img/...`，Hugo 默认不认这个路径。两种处理方式：',
      '   - 把导出的图片放进 `static/img/` 下保持同样的相对路径；',
      '   - 或在 `hugo.toml` 里加一行 `[params] imageBase = "/img"` 再自行替换链接。',
      '3. `hugo.toml.fragment` 是能直接合并进你 `hugo.toml` 的最小配置（含 `taxonomies` 与 `markup.goldmark.renderer.unsafe`）。',
      '4. 本地预览：`hugo server -D`。',
      '',
      '## front matter',
      '```yaml',
      'title / date(RFC3339 +08:00) / lastmod / draft / slug / description / tags',
      '```'
    ],
    hexo: [
      '## 用法',
      '1. 把 `source/_posts/*.md` 复制进 Hexo 站点的 `source/_posts/`。',
      '2. 图片：把图片放进 `source/img/`，正文里的 `/img/...` 就能被 Hexo 原样输出。',
      '3. 需要 `hexo-generator-index`、`hexo-renderer-marked` 等常规插件，见 `_config.yml.fragment`。',
      '4. 本地预览：`hexo clean && hexo s`。'
    ],
    jekyll: [
      '## 用法',
      '1. 把 `_posts/*.md` 复制进 Jekyll 站点的 `_posts/`（文件名已是 `YYYY-MM-DD-slug.md` 格式）。',
      '2. 需要有 `_layouts/post.html`；没有的话先用 `jekyll new` 生成一个默认主题。',
      '3. 图片放进站点根目录的 `img/` 下，正文的 `/img/...` 即可直接访问。',
      '4. 本地预览：`bundle exec jekyll serve`。'
    ],
    astro: [
      '## 用法',
      '1. 把 `src/content/posts/*.md` 复制进 Astro 项目的 `src/content/posts/`。',
      '2. 参考 `src/content/config.ts.fragment` 定义 collection（字段名与本导出完全对应）。',
      '3. 图片放进 `public/img/`。',
      '4. 本地预览：`npm run dev`。'
    ],
    ghost: [
      '## 用法（两种）',
      '1. **JSON 导入**：后台 → Settings → Advanced → Import，选择 `ghost-import.json`。',
      '   该文件按 Ghost 的导出结构生成（title / html / slug / status / published_at / tags）。',
      '2. **Markdown 导入**：如果 Ghost 版本支持 Markdown 导入，直接全选 `content/*.md`。',
      '注意：Ghost 不保存 Markdown 源文，导入后正文会变成 HTML（这是 Ghost 的设计）。'
    ],
    obsidian: [
      '## 用法',
      '1. 把 `vault/*.md` 直接丢进你的 Obsidian 库。',
      '2. front matter 里的 `tags` 会被 Obsidian 识别成标签。',
      '3. 图片链接是 `/img/...` 的绝对路径，Obsidian 里需要把图片一并放到库根目录的 `img/` 下，',
      '   或者导入后手动替换为 `![[图片名]]` 的 wiki 语法。'
    ],
    generic: [
      '## 用法',
      '`posts/*.md` 是标准 YAML front matter + Markdown 正文，绝大多数静态博客（VuePress、',
      'Next.js、Eleventy、Gatsby、VitePress…）都能直接读。',
      '`manifest.json` 里有每篇文章的 id / 标题 / 日期 / 标签 / 文件名，方便写脚本批量导入。'
    ]
  };
  return head + (bodies[target] || bodies.generic).join('\n') + '\n';
}

/**
 * @param {Array} posts 文章对象（storage.readArticles() 的返回即可）
 * @param {{ target: string, siteName?: string }} options
 * @returns {{ files: Array<{name:string, data:Buffer|string}>, target: string, count: number }}
 */
// 正文里的 /img/xxx 需要跟着搬到目标站点的静态目录，否则导出的文章图片全挂
const ASSET_DIRS = {
  hugo: 'static/',
  hexo: 'source/',
  jekyll: '',
  astro: 'public/',
  ghost: null,
  obsidian: '',
  generic: ''
};

function referencedAssets(posts) {
  const out = [];
  const seen = Object.create(null);
  (posts || []).forEach((post) => {
    const text = String((post && post.content) || '');
    const re = /(?:!\[[^\]]*\]\(|<img[^>]+src=)([^)\s"'>]+)/gi;
    let m;
    while ((m = re.exec(text))) {
      let href = m[1];
      if (!href || /^(https?:)?\/\//i.test(href) || href.indexOf('data:') === 0) continue;
      href = href.split('#')[0].split('?')[0];
      const idx = href.indexOf('/img/');
      if (idx === -1) continue;
      const rel = href.slice(idx + 5).replace(/^\/+/, '');
      if (!rel || seen[rel]) continue;
      seen[rel] = true;
      out.push(rel);
    }
  });
  return out;
}

function buildExport(posts, options) {
  const opts = options || {};
  const target = TARGETS[opts.target] ? opts.target : 'generic';
  const list = sortedPosts(posts);
  const files = [];
  const manifest = [];

  list.forEach((post) => {
    const id = slugOf(post);
    let name;
    let body;
    if (target === 'hugo') { name = TARGETS.hugo.dir + id + '.md'; body = hugoFile(post); }
    else if (target === 'hexo') { name = TARGETS.hexo.dir + id + '.md'; body = hexoFile(post); }
    else if (target === 'jekyll') {
      const d = splitDate(post.date);
      name = TARGETS.jekyll.dir + d.ymd + '-' + id + '.md';
      body = jekyllFile(post);
    } else if (target === 'astro') { name = TARGETS.astro.dir + id + '.md'; body = astroFile(post); }
    else if (target === 'obsidian') {
      name = TARGETS.obsidian.dir + String(post.title || id).replace(/[\\/:*?"<>|]/g, '-') + '.md';
      body = obsidianFile(post);
    } else if (target === 'ghost') { name = TARGETS.ghost.dir + id + '.md'; body = obsidianFile(post); }
    else { name = TARGETS.generic.dir + id + '.md'; body = genericFile(post); }

    files.push({ name, data: body });
    manifest.push({
      id: id,
      title: post.title,
      date: post.date,
      tags: post.tags || [],
      hidden: Boolean(post.hidden),
      file: name
    });
  });

  if (target === 'ghost') {
    const render = loadRenderer();
    const postsJson = list.map((post) => {
      const d = splitDate(post.date);
      return {
        title: String(post.title || '未命名文章'),
        slug: slugOf(post),
        html: render(String(post.content || '')),
        plaintext: descriptionOf(post.content, 500),
        status: post.hidden ? 'draft' : 'published',
        featured: false,
        page: false,
        published_at: d.ymd + 'T' + d.hms + '.000Z',
        created_at: d.ymd + 'T' + d.hms + '.000Z',
        updated_at: d.ymd + 'T' + d.hms + '.000Z'
      };
    });
    const tagNames = [];
    list.forEach((post) => {
      (post.tags || []).forEach((t) => { if (tagNames.indexOf(t) === -1) tagNames.push(t); });
    });
    const postsTags = [];
    list.forEach((post) => {
      (post.tags || []).forEach((t) => postsTags.push({ post_slug: slugOf(post), tag_name: t }));
    });
    files.push({
      name: 'ghost-import.json',
      data: JSON.stringify({
        db: [
          { meta: { version: '4.0.0', exported_on: Date.now() } },
          {
            data: {
              posts: postsJson,
              tags: tagNames.map(t => ({ name: t, slug: t })),
              posts_tags: postsTags,
              users: []
            }
          }
        ]
      }, null, 2)
    });
  }

  if (target === 'hugo') {
    files.push({
      name: 'hugo.toml.fragment',
      data: [
        '# 从简单博客导出，合并进你的 hugo.toml 即可',
        'baseURL = "https://example.com/"',
        'languageCode = "zh-cn"',
        'title = "' + (opts.siteName || '我的博客') + '"',
        '',
        '[taxonomies]',
        '  tag = "tags"',
        '  category = "categories"',
        '',
        '[markup.goldmark.renderer]',
        '  unsafe = true   # 允许正文里的原始 HTML',
        ''
      ].join('\n')
    });
  }

  if (target === 'hexo') {
    files.push({
      name: '_config.yml.fragment',
      data: [
        '# 从简单博客导出，合并进你的 _config.yml',
        'title: ' + (opts.siteName || '我的博客'),
        'permalink: :year/:month/:day/:title/',
        'post_asset_folder: false',
        'highlight:',
        '  enable: true',
        ''
      ].join('\n')
    });
  }

  if (target === 'astro') {
    files.push({
      name: 'src/content/config.ts.fragment',
      data: [
        "import { defineCollection, z } from 'astro:content';",
        '',
        'const posts = defineCollection({',
        "  type: 'content',",
        '  schema: z.object({',
        '    title: z.string(),',
        '    pubDate: z.coerce.date(),',
        '    description: z.string().optional(),',
        '    tags: z.array(z.string()).default([]),',
        '    draft: z.boolean().default(false),',
        '  }),',
        '});',
        '',
        'export const collections = { posts };',
        ''
      ].join('\n')
    });
  }

  // 图片附件：只有调用方提供了读取能力时才打包
  const assetDir = Object.prototype.hasOwnProperty.call(ASSET_DIRS, target) ? ASSET_DIRS[target] : '';
  if (typeof opts.resolveAsset === 'function' && assetDir !== null) {
    referencedAssets(list).forEach((rel) => {
      let hit = null;
      try { hit = opts.resolveAsset(rel); } catch (e) { hit = null; }
      if (!hit || !hit.data) return;
      const name = assetDir + 'img/' + rel;
      files.push({ name, data: hit.data });
      manifest.push({ asset: 'img/' + rel, file: name });
    });
  }

  files.push({ name: 'manifest.json', data: JSON.stringify({ target, exportedAt: new Date().toISOString(), count: manifest.length, posts: manifest }, null, 2) });
  files.push({ name: 'README.md', data: readmeFor(target, opts.siteName, manifest.length) });

  return { files, target, count: manifest.length };
}

module.exports = {
  TARGETS,
  buildExport,
  isoOf,
  splitDate
};

# 部署前端

> **只适用于 V1 / V2。** V3 是前后端不分离的单体版，前端资源在 `backend/web/` 里由 Node 进程直接发出，不需要 Cloudflare Pages，也就不需要这一步——详见 [部署 V3 单体版](monolith.md)。

前端是纯静态资源（HTML/CSS/JS），外加 `functions/` 里的几个 Cloudflare Pages Functions —— 它们负责把文章页、列表页的 HTML 和 meta 在边缘渲染出来，这样搜索引擎拿到的是完整页面。

## 1. 把仓库放到自己的账号下

不需要 Fork 也能部署（直接用 wrangler 上传），但如果想让 Pages 跟仓库联动、`push` 自动发布，建议 Fork 到自己账号下，或 clone 后推到自己的空仓库。

## 2. 改配置

前台的所有配置集中在 `frontend/app.js` 顶部的 `SITE_CONFIG`：

```js
var SITE_CONFIG = {
  name: '简单博客',                    // 站名（侧边栏、页脚、标题）
  owner: '博主',
  avatarText: '简',
  homeBio: '这里是我的个人博客…',
  apiBaseUrl: 'https://api.example.com',  // ← 后端地址
  probeUrl: '',                        // 探针面板地址，留空则不显示入口
  siteStartDate: '2026-01-01',
  socials: { github: '', x: '', telegram: '', email: '' },
  ...
};
```

只需要改 `apiBaseUrl` 指向你的后端域名；其它项部署后可以在后台「管理 → 站点信息」里改（会覆盖这里的默认值）。

## 3. 部署到 Cloudflare Pages

=== "方式 A：连接 Git 仓库（自动发布）"

    1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
    2. 选择你的仓库，构建配置填：

        | 项 | 值 |
        | --- | --- |
        | Framework preset | None |
        | Build command | 留空 |
        | Build output directory | `frontend` |

    3. 保存并部署。之后每次 `push` 到 `v1` 都会自动重新发布。

=== "方式 B：命令行上传（不需要 Fork）"

    ```bash
    npm i -g wrangler
    wrangler login
    cd simple-blog
    wrangler pages deploy frontend --project-name simple-blog
    ```

    !!! warning "`functions/` 必须一起上传"
        只传静态文件的话，文章页会退回客户端渲染，SSR 和 meta 注入都失效。

## 4. Pages 环境变量（可选）

Functions 用的是 `frontend/functions/*`，可以给 Pages 配这些变量，避免每次都改代码：

| 变量 | 作用 |
| --- | --- |
| `SITE_URL` | 站点地址，拼 canonical / sitemap |
| `SITE_NAME` | 站名（默认「简单博客」） |
| `SITE_BIO` | 站点描述 |
| `API_BASE_URL` | 后端地址（Functions 取文章用） |

不配也有默认值（`https://example.com` 等），本地预览时够用。

## 5. 绑定域名

Pages 项目 → **Custom domains** → 添加 `www.example.com`，按提示在 Cloudflare DNS 里加 CNAME（同账号一般会自动加好）。

根域 `example.com` 可以加一条 Redirect Rule 301 到 `www`，避免重复收录。

## 6. 验证

```bash
curl -sI https://www.example.com/ | head -3            # 200
curl -s https://www.example.com/posts | grep -o '<title>[^<]*'   # 文章 · 简单博客
curl -s https://www.example.com/sitemap.xml | head -5  # 真实路径，无 #/
```

## 下一步

[域名与 HTTPS :material-arrow-right:](https.md){ .md-button .md-button--primary }

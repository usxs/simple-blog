# 部署 V3 单体版（前后端不分离）

V1 / V2 都是「Cloudflare Pages 托管前端 + 自建服务器跑后端」的两段式部署：前端在边缘做 SSR，后端只提供 JSON 接口。
**V3 把这两半合成一个进程**：同一个 Node 服务既输出页面（HTML 直出），也输出接口，数据库用 SQLite，部署形态更接近 Typecho、WordPress 这类传统博客程序。

```
浏览器 ──▶ Node 进程 ──┬── GET /            首页（SPA 骨架）
                       ├── GET /post/<id>   文章页（服务端直出正文 + SEO 元信息）
                       ├── GET /posts       栏目页（服务端注入标题/描述）
                       ├── GET /admin       后台（同一个域名）
                       ├── GET /api/...     接口（同源，不需要 CORS 与 apiBaseUrl）
                       └── data/blog.db     SQLite（文章、评论、配置）
```

## 为什么值得选 V3

| | V2（两段式） | V3（单体） |
| --- | --- | --- |
| 部署单元 | Pages 前端 + Node 后端 | 一个 Node 进程 / 一个容器 |
| 域名 | 通常两个（`www` + `api`） | 一个就够 |
| 跨域配置 | 需要 CORS、Cookie 域、`apiBaseUrl` | 同源，全部不需要 |
| 页面渲染 | Cloudflare Functions | 进程内 `backend/web/ssr.js` |
| 数据库 | SQLite | SQLite（**结构完全相同**） |
| 适合 | 想要 CDN 边缘缓存、前端白嫖 Pages | 想要一台 VPS 就能跑完，或想彻底摆脱 Cloudflare |

两侧的数据库结构完全一致，所以 **V2 的 `blog.db` 可以直接丢给 V3 用**，反过来也一样。

## 获取代码

V3 在 `v3-monolith` 分支上（V1 是 `main`，V2 是 `v2-sqlite`）：

```bash
git clone -b v3-monolith https://github.com/usxs/simple-blog.git
cd simple-blog/backend
```

只需要 `backend/` 这一个目录，仓库根目录下的 `frontend/` 分支里已经不存在了——前端资源被搬进了 `backend/web/`
（`index.html`、`app.js`、`style.css`、`markdown.js`），Cloudflare 的 Functions、`_headers`、`_redirects` 全部删除。用现成镜像部署可以跳过这一节。

## 部署方式一：现成镜像（推荐，不需要源码）

V3 镜像一个容器就同时提供站点与后台，不需要 Cloudflare Pages：

```bash
mkdir -p blog && cd blog
mkdir -p data img file
sudo chown -R 1000:1000 data img file

docker run -d --name simple-blog --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/data:/app/data" -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你自己的强密码' \
  -e SITE_PUBLIC_URL='https://blog.example.com' \
  ghcr.io/usxs/simple-blog-backend:v3
```

打开 `http://服务器IP:33001/` 就是站点，后台在同一个域名的 `/admin`。数据只需要 `data/`（含 `blog.db` 与 WAL 文件）、`img/`、`file/`；不需要 `config.json`、`article/`、`Musings/`，也不需要 `BACKEND_PUBLIC_URL`。

固定某次构建或回滚时，把标签换成 CI 生成的短 SHA（如 `3a1b2c4`），或打 tag 后使用 `3.0.0`；生产环境前面加 Nginx 并配 HTTPS。

## 部署方式二：从源码构建 Docker

```bash
cd backend
cp .env.example .env
vim .env          # 至少填 SITE_PUBLIC_URL、ADMIN_PASSWORD
docker compose up -d --build
```

打开 `http://服务器IP:33001/` 就是站点，后台在同一个域名的 `/admin`（后台入口可在「管理 → 站点」里改成别的路径）。

`docker-compose.yml` 里值得注意的几项：

| 变量 | 说明 |
| --- | --- |
| `SITE_PUBLIC_URL` | 站点对外地址，用于 sitemap、canonical、og:url。**单体版必须填对**，否则 SEO 元信息会指向 `127.0.0.1` |
| `SITE_VERSION` / `SITE_BRANCH` / `SITE_COMMIT` | 后台「概览」与 `/version` 显示的版本信息，一般由 CI 注入 |
| `STORE` | 默认 `sqlite`；填 `file` 会退回 V1 的 Markdown 文件存储（用于迁移前后对比） |
| `DB_FILE` | 数据库路径，默认 `/app/data/blog.db` |

数据卷与 V2 相同：`data/`（含 `blog.db` 和 WAL 伴随文件）、`img/`、`file/`。

## 部署方式三：直接跑 Node

需要 **Node ≥ 22.5**（`node:sqlite` 是 22.5 起内置的，不需要装任何数据库驱动）。

```bash
cd backend
npm install --omit=dev          # 只装 sharp；不想转 WebP 可以不装，图片按原格式保存
STORE=sqlite \
DB_FILE=./data/blog.db \
SITE_PUBLIC_URL=https://blog.example.com \
ADMIN_PASSWORD='换成你的密码' \
PORT=33001 node server.js
```

前面挂一层 Nginx / Caddy 反代并配好 HTTPS 即可，不需要再单独部署前端。

## 静态资源与缓存

| 路径 | 内容 | 缓存 |
| --- | --- | --- |
| `/`、`/posts`、`/post/<id>` | HTML（文章页为服务端直出） | `no-cache` / 60s |
| `/app.js`、`/style.css` | 前端脚本与样式 | 带 `?v=` 时长缓存，否则 1 小时 |
| `/markdown.js` | Markdown 渲染器（**前后台共用同一份**） | 跟随静态文件 |
| `/img/*`、`/file/*` | 上传的图片与附件 | 长缓存 |
| `/admin`、`/admin.js`、`/admin.css` | 后台 | 不缓存 |

因为前后台同域，`/markdown.js` 只有一份实现（`backend/markdown.js`），后台编辑器与前台渲染不会出现两套规则。

## robots 与 sitemap

V1 / V2 的后端域名是纯 API 域名，`robots.txt` 里是 `Disallow: /`。V3 同域之后改成放行站点、只挡后台与接口：

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /file/

Sitemap: https://blog.example.com/sitemap.xml
```

`sitemap.xml` 仍由后端实时生成（`backend/backend/sitemap.js`），发布或删除文章后立即生效，不再需要 Pages Function 代理。

## 从 V1 / V2 迁到 V3

### 从 V1（Markdown 文件）直接迁移

用 V2 带来的迁移脚本，它只认 V1 的数据目录，和 V1/V2/V3 哪个程序在跑无关：

```bash
cd backend
node scripts/migrate-v1-to-v2.js --v1-dir /path/to/v1 --db ./data/blog.db
```

### 从任意版本走「便携包」

1. V1 后台「设置 → 迁移」里下载或推送便携包（`.zip`）；
2. V3 后台「设置 → 迁移」的「接收」区块里拿到迁移令牌，上传那个 zip，选 `replace` 或 `merge`。

也可以走命令行：

```bash
node scripts/import-portable.js --file /path/to/simple-blog-portable-xxxx.zip --mode merge
```

### 从 V2 直接换过来

V2 与 V3 的 `blog.db` 结构一致，把 `data/`、`img/`、`file/` 拷到 V3 的部署目录即可，不需要任何转换。

## 常见问题

**页面里的图片 404？**
V3 的图片走同域 `/img/...`。如果之前 V1/V2 的前端把图片地址拼成了 `https://api.example.com/img/...`，换成 V3 后同域即可，数据库里的 Markdown 正文不需要改。

**能不能仍然让 Cloudflare 在前面做 CDN？**
可以，纯反代（不开 Pages）即可：把 `blog.example.com` 反代到 `127.0.0.1:33001`，Cloudflare 的缓存规则照常对 `/app.js`、`/style.css`、`/img/*` 生效。

**后台入口要不要改掉？**
建议改。V3 同域之后 `/admin` 更容易被扫到，在「管理 → 站点 → 后台路径」里改成随机字符串，旧路径会直接返回 401。

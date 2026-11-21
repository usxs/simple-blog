# 简单博客

一套可以自己部署的极简个人博客系统：**Cloudflare Pages 静态前端 + 自托管 Node 后端**。

前端是零构建的纯静态 SPA（HTML/CSS/原生 JS），由 Pages 的 Functions 在边缘做服务端渲染，保证搜索引擎能拿到每篇文章的完整正文；后端是零框架依赖的 Node 服务，负责账号登录、文章/动态管理、图片上传与评论，数据全部以 Markdown / JSON 文件形式落盘，换个机器拷走目录就能搬家。

> 适合想要「自己的数据自己管」、又不想折腾数据库和构建工具链的人。整套系统单机 Docker 一条命令启动，前端免费托管在 Cloudflare。

---

## 功能

| 模块 | 说明 |
| --- | --- |
| 账号登录 | 账密登录 + `scrypt` 加盐哈希 + 服务端会话 Cookie（HttpOnly / SameSite=Strict），带登录失败限流与 CSRF 防护 |
| 文章管理 | Markdown 写作、前台实时预览、日期归档、按日期排序 |
| 动态 / 工具 / 状态 / 奇思妙想 | 多个可独立维护的内容板块，共用同一套增删改查接口 |
| 图片上传 | 后台粘贴或选择图片，服务端自动转 WebP 并压缩到 2560px 内，原图不落盘 |
| 评论 | 访客评论 + 验证码 + 后台审核 + 楼中楼回复，支持邮件/站点联系方式（不公开） |
| SEO | 真实路径路由、文章页 SSR、动态 `sitemap.xml`、`robots.txt`、Open Graph、JSON-LD 结构化数据、IndexNow 即时推送 |
| 服务器探针 | 可选，读取外部监控接口展示节点状态 |

## 架构

```
访客浏览器
   │  HTTPS
   ▼
Cloudflare Pages（前端静态资源）
   │  /post/<id>、/posts 等由 Pages Functions 在边缘注入 SSR 内容与 meta
   │  /api/* 不在 Pages 上，直接跨域请求后端
   ▼
你自己的服务器：Nginx → Docker 容器（Node 20 + sharp）
   │
   └── data/ article/ img/ file/ … 全部为宿主机文件
```

- **前端**：`frontend/`，无需构建，Pages 直接把目录当产物发布。
- **后端**：`backend/`，Node 原生 `http` 模块，只依赖 `sharp` 一个包（图片转 WebP）。
- **存储**：没有数据库。文章是 `article/<id>/<id>.md`，其它内容与评论是 JSON 文件，图片在 `img/<日期>/`。

## 目录结构

```
simple-blog/
├── backend/                  # 后端服务
│   ├── server.js             # 入口：路由、静态资源、公开 API
│   ├── admin.html/css/js     # 后台管理界面（登录、编辑、上传、评论审核）
│   ├── markdown.js           # 与服务端 SSR 共用的 Markdown 渲染器
│   ├── backend/
│   │   ├── auth.js           # 账密、会话、限流、CSRF
│   │   ├── captcha.js        # 评论验证码
│   │   ├── storage.js        # 文章/JSON 读写、文件名清洗
│   │   ├── image.js          # WebP 转换与压缩
│   │   ├── sitemap.js        # 动态 sitemap
│   │   ├── indexnow.js       # IndexNow 推送
│   │   └── probe.js          # 站点可用性探测
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── config.json           # 工具/状态/奇思妙想的初始空数据
│   └── data/                 # 运行时生成：auth.json、sessions.json、验证码密钥等
├── frontend/                 # 前端静态站（Cloudflare Pages）
│   ├── index.html
│   ├── app.js                # 路由、渲染、评论交互
│   ├── style.css
│   ├── markdown.js
│   ├── robots.txt
│   ├── _redirects
│   └── functions/            # Pages Functions：文章页 / 列表页 SSR、sitemap 代理
└── docs/
    ├── DEPLOY.md             # 详细部署与排障
    └── API.md                # 接口速查
```

## 快速开始

### 1. 部署后端

```bash
git clone https://github.com/<your-name>/simple-blog.git
cd simple-blog/backend

cp .env.example .env
vim .env            # 至少设置 ADMIN_PASSWORD、SITE_PUBLIC_URL、BACKEND_PUBLIC_URL

# 数据目录归容器的 UID 1000 所有（否则写入会报 EACCES）
sudo mkdir -p data article Musings img file
sudo chown -R 1000:1000 data article Musings img file config.json

docker compose up -d --build
docker compose logs -f --tail 50
```

访问 `http://127.0.0.1:33001/` 就是管理后台。生产环境请用 Nginx（或 Cloudflare Tunnel / Caddy）反代并启用 HTTPS，例如把 `https://api.example.com` 指到 `127.0.0.1:33001`。

### 2. 部署前端

1. 把 `frontend/` 推到 GitHub，在 Cloudflare Pages 里「连接 Git 仓库」创建项目；
2. 构建命令留空，输出目录填 `/`（或直接把 `frontend` 目录作为根）；
3. 在 Pages 项目的 **Settings → Environment variables** 里配置：

| 变量 | 示例 | 作用 |
| --- | --- | --- |
| `SITE_URL` | `https://www.example.com` | 站点主域名，用于 canonical / OG / sitemap（列表页与文章页 SSR 都依赖它） |
| `API_BASE_URL` | `https://api.example.com` | 后端域名，Functions 用它抓文章与 sitemap |
| `SITE_NAME` | `简单博客` | 站点名称 |
| `SITE_BIO` | `记录技术与生活。` | 站点简介 |

> 也可以不用环境变量，直接改 `frontend/functions/*.js` 里的 `DEFAULTS` 对象；但改完记得和 `frontend/index.html` 里的 title、canonical、OG 标签保持一致（首页 meta 是静态写死的）。

4. 还要改这些「你的站点信息」：

- `frontend/app.js` 顶部的 `SITE_CONFIG`：站点名（默认「简单博客」）、作者、`apiBaseUrl`、社交链接（留空即隐藏）、备案号等；
- `frontend/index.html` 里的 `<title>`、`description`、`canonical`、OG 标签、JSON-LD；
- `frontend/robots.txt` 里的 `Sitemap:` 域名。

### 3. 绑定域名并提交搜索引擎

- 主站 `www.example.com` → Cloudflare Pages；后端 `api.example.com` → 你的服务器（建议也走 Cloudflare 代理）。
- Google Search Console / Bing Webmaster Tools 里添加站点，提交 `https://www.example.com/sitemap.xml` 即可，之后发布文章会自动更新 sitemap 并（若配置了 IndexNow）即时推送。

更细的步骤、Nginx 配置、证书、备份与排障见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 环境变量

后端（`backend/.env`）：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 二选一 | 首次启动时创建管理员；不填则在后台「初始化」页设置 |
| `SITE_PUBLIC_URL` | 是 | 前端站点地址，写进 sitemap 与推送的 URL |
| `BACKEND_PUBLIC_URL` | 是 | 后端地址，写进 `robots.txt` 的 Sitemap 行 |
| `CAPTCHA_SECRET` | 否 | 留空自动生成并持久化到 `data/captcha-secret.json` |
| `INDEXNOW_KEY` | 否 | 填了才会在发布/删除文章后向 Bing 等推送 |
| `INDEXNOW_KEY_LOCATION` | 否 | key 文件完整 URL，默认 `${SITE_PUBLIC_URL}/<KEY>.txt` |
| `PROBE_SERVERS_URL` | 否 | 外部监控接口，留空则探针列表为空 |
| `HOST_PORT` | 否 | 宿主机端口，默认 `33001` |
| `AUTH_DATA_DIR` | 否 | 覆盖会话/凭据的存放目录（主要给测试用） |

## 接口速查

公开接口（无需登录）：

```
GET  /api/sync?module=posts            # 文章列表（含正文，供前端列表与 SSR 使用）
GET  /api/comments?postId=<id>         # 已审核评论
GET  /api/public/post/<id>             # 单篇文章（供 Pages Functions SSR 抓取）
GET  /api/captcha                      # 获取验证码题目与签名
POST /api/comments/submit              # 提交评论（带验证码与蜜罐）
GET  /sitemap.xml  GET /robots.txt     # SEO
```

需要登录（Cookie 会话）：

```
GET  /api/auth/status                  # 当前登录态 / 是否需要初始化
POST /api/auth/setup | login | logout | change-password
GET  /api/sync?module=comments         # 含待审核评论
POST /api/save    POST /api/delete     # 内容增删改
POST /api/upload                       # 图片/附件上传（图片自动转 WebP）
```

完整参数见 [docs/API.md](docs/API.md)。

## 安全说明

- 密码用 `scrypt`（N=16384, r=8, p=1）加盐哈希，校验走恒定时间比较；用户名同样做恒定时间处理，避免枚举。
- 会话令牌只在 Cookie 中，服务端只存它的 SHA-256；Cookie 带 `HttpOnly` + `SameSite=Strict`，HTTPS 下自动加 `Secure`。滑动 7 天、绝对上限 30 天。
- 登录按 IP 限流：15 分钟内失败 5 次锁 15 分钟；登录失败提示统一为「用户名或密码错误」。
- 所有写操作校验 `Origin` / `Sec-Fetch-Site`，跨站请求直接 403。
- 上传文件名做清洗（去掉路径分隔符与控制字符），图片在服务端转换，原始文件不落盘。

> 务必通过 HTTPS 对外提供服务。明文 HTTP 下 Cookie 的 `Secure` 不会生效，密码也会以明文经过网络。

## 注意事项

1. **改代码后要重建镜像**：`docker compose up -d --build`。数据在宿主机目录里，重建不会丢。
2. **目录权限**：容器以 UID 1000 运行，`data/`、`article/`、`img/` 等宿主机目录必须是 `1000:1000` 可写，否则首次初始化会失败并提示「管理员数据目录不可写」。
3. **`config.json` 是文件挂载**：如果宿主机上这个文件不存在，Docker 会把同名的**目录**挂进去，导致后端读不到配置。第一次启动前确保 `backend/config.json` 存在（仓库里已带空模板）。
4. **图片格式**：`.jpg/.jpeg/.png/.gif` 会转成 WebP；SVG 与 AVIF 原样保留；已是 `.webp` 的不再重编码。转换后若反而更大，会保留原图。想关闭转换设 `IMAGE_WEBP_DISABLE=1`。
5. **历史图片不追溯**：老文章的 Markdown 里写的是当时的文件名，重新转换会让链接失效，所以只对之后上传的图片生效。
6. **站点名称 / 域名要改多处**：`app.js` 的 `SITE_CONFIG`、`index.html` 的 meta、`functions/` 的环境变量、`robots.txt`。文章页与列表页的 meta 由 Functions 正则替换生成，只要 `index.html` 的结构（title/description/canonical/og 标签）在，改名不会失效。
7. **SEO 与域名**：`canonical` 用的是 `SITE_URL`，如果站点同时存在 `example.com` 和 `www.example.com`，请固定一个并让另一个 301 过去，否则会被判重复内容。
8. **备份**：只需备份 `backend/` 下的 `config.json`、`article/`、`Musings/`、`img/`、`file/`、`data/` 六个路径，建议 `tar` 打包后异地保存。

## 排障

| 现象 | 原因与处理 |
| --- | --- |
| 后台打不开，提示 502 | 容器没起来：`docker compose ps` / `docker compose logs --tail 100` |
| 初始化管理员报「数据目录不可写」 | 宿主机目录属主不对：`sudo chown -R 1000:1000 data article Musings img file` |
| `Conflict. The container name "..." is already in use` | 之前用别的 compose 项目建过同名容器：`docker rm -f simple-blog-backend` 后重新 `up -d` |
| 前端能打开但文章 404 / 列表为空 | `API_BASE_URL` 配错，或后端 CORS 被拦；浏览器控制台看 `/api/sync` 请求 |
| 图片上传后仍是 jpg | 构建时 `sharp` 没装上（看 `docker compose logs` 里的 warn），重新 `--build`；或设置了 `IMAGE_WEBP_DISABLE=1` |
| sitemap 显示的是首页 | Pages Functions 未部署（目录名必须是 `functions/`），或用了 `_redirects` 但域名写错 |

## 许可证

[MIT](LICENSE)

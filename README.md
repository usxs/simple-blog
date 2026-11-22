# 简单博客

**简体中文** · [English](README.en.md)

一套可以自己部署的极简个人博客系统：**Cloudflare Pages 静态前端 + 自托管 Node 后端**。

前端是零构建的纯静态 SPA（HTML/CSS/原生 JS），由 Pages 的 Functions 在边缘做服务端渲染，保证搜索引擎能拿到每篇文章的完整正文；后端是零框架依赖的 Node 服务，负责账号登录、文章/动态管理、图片上传与评论，数据全部以 Markdown / JSON 文件形式落盘，换个机器拷走目录就能搬家。

> 适合想要「自己的数据自己管」、又不想折腾数据库和构建工具链的人。整套系统单机 Docker 一条命令启动，前端免费托管在 Cloudflare。

---

## 界面预览

> 截图来自本地实际运行的实例（示例数据）。站点提供黑白两套主题，可跟随设备 / 系统设置自动切换。

| 前台 | 后台 |
| --- | --- |
| ![首页](docs/screenshots/home.png) | ![文章列表](docs/screenshots/posts.png) |
| <sub>首页</sub> | <sub>文章列表：按日期倒排，可搜索，右侧统计</sub> |
| ![文章详情](docs/screenshots/article.png) | ![评论区](docs/screenshots/comments.png) |
| <sub>文章详情：Markdown 渲染、代码块、MIT 授权声明</sub> | <sub>评论区：算术验证码、楼中楼回复</sub> |
| ![登录](docs/screenshots/admin-login.png) | ![后台](docs/screenshots/admin.png) |
| <sub>后台登录：账密 + 服务端会话，可开两步验证</sub> | <sub>后台：文章增删改、图片上传、评论审核</sub> |
| ![管理](docs/screenshots/admin-settings.png) | ![账号安全](docs/screenshots/admin-settings-account.png) |
| <sub>管理：站点信息与前台栏目（开关 / 改名 / 改路径 / 换图标）</sub> | <sub>账号安全：管理员账号、两步验证、通行密钥、登录会话</sub> |

### 移动端

手机浏览器打开即是单列布局：侧边栏收起为**底部悬浮导航**，当前页面自动高亮；文章正文、代码块、评论表单、验证码都按宽度重排，不需要横向滚动或缩放。375px（iPhone SE）到 430px 的窄屏单独压缩过导航间距，六个入口一屏放得下。

| 手机首页 | 手机文章列表 |
| --- | --- |
| ![移动端首页](docs/screenshots/mobile-home.png) | ![移动端文章列表](docs/screenshots/mobile-posts.png) |
| 手机文章详情 | 手机评论区 |
| ![移动端文章](docs/screenshots/mobile-article.png) | ![移动端评论](docs/screenshots/mobile-comments.png) |

---

## 功能

| 模块 | 说明 |
| --- | --- |
| 账号登录 | 账密登录 + `scrypt` 加盐哈希 + 服务端会话 Cookie（HttpOnly / SameSite=Strict），带登录失败限流与 CSRF 防护 |
| 管理页 | 后台「管理」页集中放站点信息（名称 / 头像文字 / 浏览器标题 / 副标题）、改用户名改密码、两步验证、通行密钥、登录会话管理；改完前台立即生效，无需重新部署 |
| 登录会话 | 区分在线 / 离线 / 历史会话，显示设备与浏览器；点开可看 IP、归属地、设备详情、在线时长和完整 UA，并支持改备注、踢下线、封禁 IP 或设备（黑名单可解除） |
| 两步验证（2FA） | 标准 TOTP（RFC 6238），用 Google Authenticator / 1Password 等扫码绑定；登录需再输 6 位动态码；提供 10 个一次性备用码，用掉即作废 |
| 通行密钥（Passkey） | WebAuthn 指纹 / 面容 / 安全密钥登录，服务端只存公钥，支持多设备注册与逐个删除；也可作为免密码登录入口 |
| 文章管理 | Markdown 写作、前台实时预览、日期归档、按日期排序 |
| Markdown 渲染 | 标题 / 列表（多级嵌套）/ 引用（可嵌套）/ 分隔线 / 表格（对齐）/ 任务清单 / 行内样式；围栏代码带语言标签、行号、一键复制与放大灯箱；```` ```mermaid ```` 流程图在浏览器端渲染 |
| 动态 / 工具 / 状态 / 奇思妙想 | 多个可独立维护的内容板块，共用同一套增删改查接口 |
| 图片上传 | 后台粘贴或选择图片，服务端自动转 WebP 并压缩到 2560px 内，原图不落盘 |
| 评论 | 访客评论 + 验证码 + 后台审核 + 楼中楼回复，支持邮件/站点联系方式（不公开） |
| SEO | 真实路径路由、文章页 SSR、动态 `sitemap.xml`、`robots.txt`、Open Graph、JSON-LD 结构化数据、IndexNow 即时推送 |
| 服务器探针 | 后台侧边栏「探针」可切换数据源：CF-Server-Monitor（`/api/servers`）或极简探针 monitor（`/api/nodes`），两种节点统一成同一套卡片 |
| 栏目开关 | 在「管理 → 前台栏目」一键决定前台是否显示；关闭后前台导航隐藏，直接访问该地址会显示「栏目已关闭」占位页 |
| 栏目自定义 | 栏目可改名（最多 12 字）、改访问路径（如把 `/moments` 改成 `/diary`）、换图标：16 个内置图标任选，或自行上传 PNG / JPG / SVG / WebP |
| 栏目排序 | 在「管理 → 前台栏目」拖动左侧 ⋮⋮ 调整顺序，桌面侧边栏、手机底栏、后台侧边栏三处同步生效（顺序存在 `data/site.json`） |
| 自定义路径 | 栏目路径可改，`/posts`、`/diary` 之类都行；改名后旧地址仍可访问并自动跳转，导航链接、`sitemap.xml`、SSR 元信息同步更新 |
| 部署版本 | 鼠标悬停侧边栏「节点 ONLINE」弹出小气泡，显示当前线上部署的短版本号、提交与分支，排查「线上到底是哪一版」很方便 |
| 文章搜索 | 文章列表页搜索框：标题 / 摘要 / 标签模糊匹配，中文按子串、英文支持子序列；输入法组合结束后立即过滤，支持回车与 Esc 清空，列表只更新容器不重建输入框 |
| 移动端 | ≤860px 自动切单列布局并显示底部悬浮导航，375–430px 窄屏做了专门压缩，六个入口一屏放得下 |
| 渐进加载 | 站点配置（栏目开关 / 名称 / 路径 / 顺序）缓存在浏览器本地：首屏直接按上次配置渲染，不闪未关闭的栏目；首页不等网络，节点状态与探针自己慢慢刷新；后端宕机时前台照常可读 |

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
├── README.md                 # 项目说明、界面预览、部署与注意事项
├── CHANGELOG.md              # 更新日志
├── LICENSE                   # MIT
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
│   └── functions/            # Pages Functions：文章页 / 列表页 SSR、sitemap 代理、部署版本端点
└── docs/
    ├── DEPLOY.md             # 详细部署与排障
    ├── API.md                # 接口速查
    └── screenshots/          # README 使用的界面截图
```

## 快速开始

下面是「从零到能访问」的完整流程，按顺序做即可。每一步都给了验证方法，出错能立刻定位。

### 0. 准备

| 需要 | 说明 |
| --- | --- |
| 一台服务器 | Linux（Debian/Ubuntu 均可），1 核 1G 起；VPS 或家里的机器都行，只要外网能访问 |
| 域名 | 建议两个子域：`www.example.com` 给前端，`api.example.com` 给后端 |
| Cloudflare 账号 | 前端用 Pages 免费托管，需要账号 |
| Docker | 服务器上装 Docker Engine + Compose 插件（下面第 2 步会检查） |

### 1. 拉代码（需要先 Fork 吗？）

**不需要 Fork 也能完整部署。** Fork 只是「让前端能自动部署」或「想自己改代码」时才需要。

| 你的情况 | 怎么做 |
| --- | --- |
| 只想跑起来，不打算改代码 | 直接 `git clone` 本仓库（或下载 ZIP），前端用 `wrangler` 上传，不需要 GitHub 上有你自己的副本 |
| 想让 Cloudflare Pages 连接仓库、以后 push 自动发布 | 需要一个**你自己账号下**的仓库：点右上角 **Fork**，或 clone 后 push 到你新建的空仓库 |
| 想长期自己维护、改代码 | 同上，Fork（或新建仓库）后改成你的地址 |

```bash
# 情况 1：只部署，不 Fork
git clone https://github.com/usxs/simple-blog.git
cd simple-blog

# 情况 2/3：已经 Fork 到你自己账号下
git clone https://github.com/<your-name>/simple-blog.git
cd simple-blog
```

> Fork 之后，本仓库的更新不会自动同步到你的副本；需要同步时在 GitHub 上点 **Sync fork**，或在本地 `git remote add upstream https://github.com/usxs/simple-blog.git && git fetch upstream && git merge upstream/main`。

### 2. 部署后端（服务器上）

#### 2.1 检查 Docker

```bash
docker --version          # 需要 20.10+
docker compose version    # 需要 v2（命令是 docker compose，不是 docker-compose）
```

没有的话装一下（Debian/Ubuntu）：

```bash
curl -fsSL https://get.docker.com | sh
```

#### 2.2 准备数据目录并修正权限

容器以 UID `1000` 运行，宿主机目录必须让这个用户能写，否则首次初始化会报「数据目录不可写」：

```bash
cd backend
mkdir -p data article Musings img file
touch config.json         # 必须是文件，不能是目录（Docker 会把不存在的挂载点建成目录）
sudo chown -R 1000:1000 data article Musings img file config.json
```

#### 2.3 写环境变量

```bash
cp .env.example .env
vim .env
```

至少要改这四项：

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=换成你自己的强密码      # 首次启动用它创建管理员，之后不会再生效
SITE_PUBLIC_URL=https://www.example.com   # 前端地址，写进 sitemap 与推送链接
BACKEND_PUBLIC_URL=https://api.example.com # 后端地址，写进 robots.txt
```

其余变量（验证码密钥、IndexNow、探针数据源、站点名称初始值）可以先留空，后文会用到时再补。

#### 2.4 启动

```bash
docker compose up -d --build
docker compose ps           # 应看到 Up (healthy)
docker compose logs --tail 50
```

> 只要改过代码或 `.env`，都要带 `--build` 重新构建；只重启容器不会更新代码。

#### 2.5 验证后端

```bash
curl -s http://127.0.0.1:33001/api/auth/status
# {"ok":true,"authed":false,"setupNeeded":false,"dataWritable":true}
```

`setupNeeded:false` 说明管理员已按 `.env` 创建好；`dataWritable:true` 说明目录权限正确。两个字段任一是 `false`，回到 2.2 检查目录权限。

#### 2.6 给后端配域名与 HTTPS（Nginx 反代）

把 `api.example.com` 反代到 `127.0.0.1:33001` 即可。示例（宝塔 / LNMP 面板里也能直接建反代站点）：

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 30m;          # 图片/附件上传

    location / {
        proxy_pass http://127.0.0.1:33001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # 必填：后端据此判断是否给 Cookie 加 Secure
        proxy_set_header X-Forwarded-Host  $host;     # Passkey 的 rpId 依赖它
    }
}
```

证书可以用 `certbot --nginx -d api.example.com` 一键签发。

#### 2.7 登录后台

浏览器打开 `https://api.example.com/admin.html`，用 `.env` 里的账密登录，就进入后台了（文章、评论、图片、栏目开关都在这里）。建议登录后立刻在「管理 → 管理员账号」把密码换成新的。

### 3. 部署前端（Cloudflare Pages）

前端是纯静态文件，不需要构建。两种方式任选：

#### 方式 A：连接 Git 仓库（推荐，之后 push 即自动发布）

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，选中你的仓库；
2. 构建设置：

| 项 | 值 |
| --- | --- |
| Framework preset | None |
| Build command | 留空 |
| Build output directory | `frontend` |

3. 保存并部署，得到 `<随机串>.pages.dev` 域名。

#### 方式 B：命令行上传（不接 Git 也行）

```bash
npm i -g wrangler
wrangler pages deploy frontend --project-name simple-blog
```

> `functions/` 目录必须一起上传，`wrangler` 会自动把它编译成边缘函数；直接拖拽 HTML 不走 Functions，文章页就没有服务端渲染。

#### 3.1 配置 Pages 环境变量

Pages 项目 → **Settings → Environment variables**（Production 与 Preview 都加）：

| 变量 | 示例 | 作用 |
| --- | --- | --- |
| `SITE_URL` | `https://www.example.com` | canonical / OG / sitemap 用的站点地址 |
| `API_BASE_URL` | `https://api.example.com` | Functions 抓文章与 sitemap 的后端地址 |
| `SITE_NAME` | `简单博客` | 站点名称（SSR 页面标题） |
| `SITE_BIO` | `记录技术与生活。` | 站点简介（SSR 描述） |

#### 3.2 改站点自身的信息

- `frontend/app.js` 顶部 `SITE_CONFIG`：站点名、作者、`apiBaseUrl`（改成你的后端域名）、社交链接（留空即隐藏）、站点起始日期；
- `frontend/index.html`：`<title>`、`description`、`canonical`、OG 标签、JSON-LD 里的域名；
- `frontend/robots.txt`：`Sitemap:` 那一行的域名。

改完提交，Pages 会自动重新发布（方式 B 需要重新执行 `wrangler pages deploy`）。

#### 3.3 绑定自己的域名

Pages 项目 → **Custom domains** → 添加 `www.example.com`，按提示在 Cloudflare DNS 里加 CNAME。建议：

- 主域 `example.com` 301 到 `www.example.com`（或反过来，二选一，不要两边都能访问）；
- 前端与后端都在 Cloudflare 代理下时，后端记得关掉会拦截 API 的防火墙规则。

### 4. 上线检查清单

逐条点一遍，全绿就说明部署没问题：

| 检查 | 期望 |
| --- | --- |
| 打开 `https://www.example.com/` | 首页正常，侧边栏「节点」显示 ONLINE |
| 打开任一文章 `/post/<id>` | 正文完整；查看网页源码，`<title>` 是文章标题，`reader-content` 里有正文（SSR 生效） |
| `https://www.example.com/sitemap.xml` | 返回 XML，URL 都是真实路径（没有 `#/`） |
| `https://api.example.com/admin.html` | 能登录后台 |
| 后台上传一张图 | 返回的 Markdown 里是 `.webp`，前台显示正常 |
| 前台提交一条评论 | 提示「待审核」，后台评论审核里能看到 |
| 后台「管理 → 前台栏目」关掉一个栏目 | 前台侧边栏立即消失，直接访问该地址显示「栏目已关闭」 |

### 5. 提交给搜索引擎

1. Google Search Console 添加资源，**推荐用「网域」类型**（DNS TXT 验证），而不是「网址前缀」——否则 sitemap 的主机名对不上会一直提示「无法读取」；
2. Bing Webmaster Tools 可以直接从 GSC 导入站点；
3. 两边都提交 `https://www.example.com/sitemap.xml`；
4. 想让 Bing 更快收录新文章：后端 `.env` 里填 `INDEXNOW_KEY=<32 位随机串>`，并把同名 `<KEY>.txt`（内容就是这个 key）放进 `frontend/` 根目录一起部署。

更细的步骤、证书、备份与排障见 [docs/DEPLOY.md](docs/DEPLOY.md)。

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
| `PROBE_ENABLED` | 否 | 是否启用前台探针数据，`0` 关闭（默认启用） |
| `PROBE_PROVIDER` | 否 | 探针类型：`cf`（CF-Server-Monitor）或 `minimal`（极简探针 monitor） |
| `PROBE_URL` | 否 | 探针面板首页地址，后端自动拼 `/api/servers`（cf）或 `/api/nodes`（minimal） |
| `PROBE_PANEL_URL` | 否 | 「打开监控后台」按钮的跳转地址，留空则前台不显示该按钮 |
| `SITE_NAME` / `SITE_AVATAR` / `SITE_TITLE` / `SITE_SUBTITLE` | 否 | 站点信息初始值；首次启动后可在后台「管理」页修改，改完立即生效 |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | 否 | 通行密钥的 RP ID 与来源；默认按请求的 `X-Forwarded-Host` 推导 |
| `HOST_PORT` | 否 | 宿主机端口，默认 `33001` |
| `AUTH_DATA_DIR` | 否 | 覆盖会话/凭据的存放目录（主要给测试用） |

## 接口速查

公开接口（无需登录）：

```
GET  /api/sync?module=posts            # 文章列表（匿名返回摘要 + ETag；登录后返回正文）
GET  /api/search?q=<关键词>[&limit=20] # 文章搜索（中文子串 / 英文子序列，返回摘要片段）
GET  /api/comments?postId=<id>         # 已审核评论
GET  /api/public/post/<id>             # 单篇文章（供 Pages Functions SSR 抓取）
GET  /api/site                         # 站点信息（名称/头像/标题/副标题/栏目开关/名称/路径/图标/顺序，前台启动时读取）
GET  /version                          # （Pages 端）当前部署的短版本号
GET  /api/deploy-version               # 后端代理读取上面的 /version（缓存 60s），后台侧边栏「状态」处显示
GET  /api/probe-servers                # 探针节点列表（来源由后台侧边栏「探针」决定）
GET  /api/captcha                      # 获取验证码题目与签名
POST /api/comments/submit              # 提交评论（带验证码与蜜罐）
GET  /sitemap.xml  GET /robots.txt     # SEO
```

需要登录（Cookie 会话）：

```
GET  /api/auth/status                  # 当前登录态 / 是否需要初始化
POST /api/auth/setup | login | logout | change-password
POST /api/auth/passkey/login-options | passkey/login   # 通行密钥免密登录（公开）
GET  /api/sync?module=comments         # 含待审核评论
POST /api/save    POST /api/delete     # 内容增删改
POST /api/upload                       # 图片/附件上传（图片自动转 WebP）
GET  /api/admin/overview               # 管理页数据汇总（站点/2FA/通行密钥/会话）
POST /api/admin/site                   # 保存站点信息
POST /api/auth/change-username         # 改管理员用户名
POST /api/auth/totp/setup | enable | disable | backup-codes
GET  /api/auth/passkeys                # 通行密钥列表
POST /api/auth/passkey/register-options | register | delete
GET  /api/auth/sessions                # 会话总览（在线 / 历史 / 黑名单）
POST /api/auth/sessions/revoke-others  # 下线其它设备
POST /api/auth/sessions/revoke | rename | block   # 踢下线 / 改备注 / 封禁 IP 或设备
POST /api/auth/blocklist/remove        # 解除封禁
GET  /api/auth/sessions/geo?ip=        # IP 归属地
```

完整参数见 [docs/API.md](docs/API.md)。

## 安全说明

- 密码用 `scrypt`（N=16384, r=8, p=1）加盐哈希，校验走恒定时间比较；用户名同样做恒定时间处理，避免枚举。
- 会话令牌只在 Cookie 中，服务端只存它的 SHA-256；Cookie 带 `HttpOnly` + `SameSite=Strict`，HTTPS 下自动加 `Secure`。滑动 7 天、绝对上限 30 天。
- 登录按 IP 限流：15 分钟内失败 5 次锁 15 分钟；登录失败提示统一为「用户名或密码错误」。
- 所有写操作校验 `Origin` / `Sec-Fetch-Site`，跨站请求直接 403。
- 上传文件名做清洗（去掉路径分隔符与控制字符），图片在服务端转换，原始文件不落盘。
- 两步验证基于标准 TOTP（HMAC-SHA1、30 秒步长、允许前后 1 个窗口）；备用码只存 SHA-256，命中后立刻作废。
- 通行密钥（Passkey）走 WebAuthn：服务端只保存公钥与签名计数器，私钥永不离开设备；会校验 challenge、origin、rpIdHash 与计数器回退（防重放）。
- 修改密码、关闭两步验证、删除通行密钥、改用户名都需要再验证一次当前密码。

> 务必通过 HTTPS 对外提供服务。明文 HTTP 下 Cookie 的 `Secure` 不会生效，密码也会以明文经过网络。

## 注意事项

1. **改代码后要重建镜像**：`docker compose up -d --build`。数据在宿主机目录里，重建不会丢。
2. **目录权限**：容器以 UID 1000 运行，`data/`、`article/`、`img/` 等宿主机目录必须是 `1000:1000` 可写，否则首次初始化会失败并提示「管理员数据目录不可写」。
3. **`config.json` 是文件挂载**：如果宿主机上这个文件不存在，Docker 会把同名的**目录**挂进去，导致后端读不到配置。第一次启动前确保 `backend/config.json` 存在（仓库里已带空模板）。
4. **图片格式**：`.jpg/.jpeg/.png/.gif` 会转成 WebP；SVG 与 AVIF 原样保留；已是 `.webp` 的不再重编码。转换后若反而更大，会保留原图。想关闭转换设 `IMAGE_WEBP_DISABLE=1`。
5. **历史图片不追溯**：老文章的 Markdown 里写的是当时的文件名，重新转换会让链接失效，所以只对之后上传的图片生效。
6. **站点名称 / 域名要改多处**：站点名称、头像文字、浏览器标题、副标题都可以直接在后台「管理」页改（前端启动时读 `/api/site`，文章页与列表页 SSR 也会读取），不需要重新部署；但 `index.html` 里的静态 meta、`functions/` 环境变量、`robots.txt` 里的域名仍需手工同步（用于搜索引擎与无 JS 场景）。
7. **栏目开关 / 改名 / 改路径 / 图标 / 顺序**：都在「管理 → 前台栏目」里完成，保存后即时生效，不需要重新部署前端。关掉的栏目在前台侧边栏、手机底栏、后台侧边栏都会隐藏（在管理页重新打开即可）。首页可改名换图标但不能关闭。
    - 路径只能用字母、数字和短横线（1–24 位），不能与 `post`、`api`、`admin` 等保留路径冲突；两条栏目不能撞同一路径
    - 改路径后旧地址仍然可用（自动 302 到新路径），但 `sitemap`、导航链接与 SSR 元信息都以新路径为准
    - 上传的图标存在 `img/日期/`，备份时一并带走
    - 拖动每行左侧的 ⋮⋮ 可以调整顺序，保存后前台侧边栏、手机底栏、后台侧边栏同时按新顺序排列
8. **站点配置会在浏览器本地缓存**：前台把最近一次 `/api/site`（栏目开关 / 名称 / 路径 / 顺序）存在 `localStorage` 的 `sp_site_cache_v1` 里，首屏直接按缓存渲染，所以不会先闪一下「本该隐藏的栏目」；后端不可达或很慢时也照常显示。改动会在下次打开页面时拉新并覆盖缓存（后端用 `updatedAt` 判断是否变化）。如果改完发现前台没更新，强制刷新（`Cmd/Ctrl + Shift + R`）或清掉这条缓存即可。
9. **首屏不等后端**：首页、列表页、文章页都先用本地数据/SSR 内容渲染，侧边栏「节点 ONLINE」、探针数据、后台配置各自异步刷新；网络慢或后端挂了不会白屏，只是节点状态显示 OFFLINE。
10. **SEO 与域名**：`canonical` 用的是 `SITE_URL`，如果站点同时存在 `example.com` 和 `www.example.com`，请固定一个并让另一个 301 过去，否则会被判重复内容。
11. **备份**：只需备份 `backend/` 下的 `config.json`、`article/`、`Musings/`、`img/`、`file/`、`data/` 六个路径，建议 `tar` 打包后异地保存。
12. **两步验证的备用码**：启用 2FA 时生成的 10 个备用码只显示一次，请立刻保存；丢失验证器又没有备用码时，可在服务器上删除 `backend/data/auth.json` 里的 `totp` 字段后重启（会关闭 2FA）。
13. **通行密钥需要 HTTPS**：`http://` 或直接用 IP 访问时浏览器不提供 Passkey 接口；后端会按 `X-Forwarded-Host` 推导 `rpId`，反代域名与后端域名不一致时用 `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` 显式指定。注册的密钥与域名绑定，换域名后需要重新注册。
14. **流程图依赖 CDN**：```` ```mermaid ```` 代码块由浏览器端按需从 jsDelivr 加载 `mermaid@11` 渲染，不在构建产物里；内网/离线环境不会报错，只是保留为一段源码文本。改 CDN 地址只需调整 `frontend/app.js` 与 `backend/admin.js` 里 `loadMermaid()` 的 `import()` 地址。
15. **评论防刷**：同一 IP 两条评论至少间隔 30 秒，每小时最多 8 条、每天最多 30 条；验证码每 10 分钟最多签发 30 次。触发限制时接口返回 `429`（带 `Retry-After`），前台提交按钮会显示倒计时。需要给正常访客放宽，改 `backend/captcha.js` 的 `CAPTCHA_MAX` 与 `backend/server.js` 里的间隔/条数常量即可。
16. **文章顺序**：后台列表与前台列表都以发布日期（`date`）从新到旧，日期相同再看修改时间。想调顺序直接改文章里的 `date`。

## 排障

| 现象 | 原因与处理 |
| --- | --- |
| 后台打不开，提示 502 | 容器没起来：`docker compose ps` / `docker compose logs --tail 100` |
| 初始化管理员报「数据目录不可写」 | 宿主机目录属主不对：`sudo chown -R 1000:1000 data article Musings img file` |
| `Conflict. The container name "..." is already in use` | 之前用别的 compose 项目建过同名容器：`docker rm -f simple-blog-backend` 后重新 `up -d` |
| 前端能打开但文章 404 / 列表为空 | `API_BASE_URL` 配错，或后端 CORS 被拦；浏览器控制台看 `/api/sync` 请求 |
| 图片上传后仍是 jpg | 构建时 `sharp` 没装上（看 `docker compose logs` 里的 warn），重新 `--build`；或设置了 `IMAGE_WEBP_DISABLE=1` |
| sitemap 显示的是首页 | Pages Functions 未部署（目录名必须是 `functions/`），或用了 `_redirects` 但域名写错 |
| 改了栏目配置但前台没变 | 前端用的是本地缓存的站点配置：强制刷新（`Cmd/Ctrl + Shift + R`），或在控制台执行 `localStorage.removeItem('sp_site_cache_v1')` 后刷新 |
| 侧边栏第一个栏目上方多一行空白 | 旧版本的排版 bug（重排后残留空 `<li>`），更新 `frontend/app.js` 与 `frontend/style.css` 即可 |

## 更新日志

版本变更、修复记录见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

[MIT](LICENSE)

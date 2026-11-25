# 部署详解

本文按「后端 → 反代 → 前端 → 域名与 SEO → 备份」的顺序，把一套完整上线流程走一遍。命令以 Ubuntu + 宝塔面板为例，其它发行版把 `chown` / 路径换掉即可。

---

## 一、准备

- 一台能跑 Docker 的服务器（1C1G 足够），已安装 `docker` 与 `docker compose` v2；
- 一个域名，例如 `example.com`，计划用 `www.example.com` 做博客、`api.example.com` 做后端；
- Cloudflare 账号（托管 DNS 并部署前端，免费额度够用）。

!!! note "先确定做哪个版本"
    本文按 **V1 / V2**（Cloudflare Pages + 自托管后端）写。**V3** 是前后端不分离的单体版，没有 Pages 那一段，部署见 [部署 V3 单体版](../handbook/start/monolith.md)；三个版本的区别见 [版本选择](../handbook/start/versions.md)。

```bash
# 检查环境
docker -v && docker compose version
```

## 二、部署后端

### 方式 0：直接用 Docker Hub 镜像（最快）

不想拉源码、不想本地构建，可以直接跑发布好的镜像：

```bash
mkdir -p blog-backend && cd blog-backend
mkdir -p data article Musings img file && touch config.json
sudo chown -R 1000:1000 data article Musings img file config.json

docker run -d --name simple-blog-backend --restart unless-stopped \
  -p 127.0.0.1:33001:33001 \
  -v "$PWD/config.json:/app/config.json" \
  -v "$PWD/article:/app/article" -v "$PWD/Musings:/app/Musings" \
  -v "$PWD/img:/app/img" -v "$PWD/file:/app/file" -v "$PWD/data:/app/data" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你自己的密码' \
  -e SITE_PUBLIC_URL='https://www.example.com' \
  -e BACKEND_PUBLIC_URL='https://api.example.com' \
  starspacec/simple-blog-backend:latest
```

镜像：<https://hub.docker.com/r/starspacec/simple-blog-backend>，标签 `latest` 与版本号；当前发布的是 `linux/amd64`。

用 compose 的话，把仓库里的 `docker-compose.hub.yml` 和 `.env.example` 拷到目录里，改名 `.env` 后：

```bash
docker compose -f docker-compose.hub.yml up -d
```

后续步骤（Nginx 反代、HTTPS、前端 Pages）与下面的「方式 A」完全相同。

### 方式 A：从源码构建

```bash
git clone https://github.com/<your-name>/simple-blog.git
cd simple-blog/backend

cp .env.example .env
```

编辑 `.env`：

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=换成你自己的强密码      # 至少 8 位
SITE_PUBLIC_URL=https://www.example.com
BACKEND_PUBLIC_URL=https://api.example.com
HOST_PORT=33001
```

准备数据目录并修正权限（**最容易踩的坑**）：

```bash
sudo mkdir -p data article Musings img file
sudo chown -R 1000:1000 data article Musings img file config.json
```

> 容器内以 UID 1000 运行。如果宿主机目录属主是 root，初始化管理员时会报
> `EACCES: permission denied`，接口返回「管理员数据目录不可写」。

启动：

```bash
docker compose up -d --build
docker compose ps                 # 等 STATUS 变成 healthy
docker compose logs --tail 50
```

本机验证：

```bash
curl -s http://127.0.0.1:33001/api/auth/status
# {"ok":true,"authed":false,"setupNeeded":false,"dataWritable":true}
```

`setupNeeded:false` 说明 `.env` 里的管理员已经创建好；如果之前没填 `ADMIN_PASSWORD`，第一次打开后台会出现初始化向导，设置完成后 `auth.json` 落盘。

## 三、Nginx 反代 + HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 20m;          # 上传图片/附件用

    location / {
        proxy_pass http://127.0.0.1:33001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # Cookie 的 Secure 依赖这个头
        proxy_read_timeout 120s;
    }
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}
```

两个要点：

1. **一定要带上 `X-Forwarded-Proto`**，后端据此判断是否给 Cookie 加 `Secure`；漏了的话 HTTPS 站点上 Cookie 依然可用，但弱化了防护。
2. 如果前面还有 Cloudflare 代理，把 CF 的 IPv4/IPv6 段加进 `set_real_ip_from`，否则登录限流会按 Cloudflare 的出口 IP 计数，容易误伤所有访客。

## 四、部署前端到 Cloudflare Pages

### 先确认：需要 Fork 吗？

| 目标 | 是否需要 Fork | 做法 |
| --- | --- | --- |
| 只部署（后端 Docker + 前端上传静态文件） | 否 | 直接 clone 官方仓库；前端用 `wrangler pages deploy` 上传，不依赖你的 GitHub 仓库 |
| 想 push 即自动发布 | 是 | Fork 一份到你的账号，再用下面的「Connect to Git」连它 |
| 想改代码长期维护 | 建议 | Fork 或新建仓库后改地址，之后从 `upstream` 同步更新 |

Fork 后上游更新不会自动过来：GitHub 上点 **Sync fork**，或本地
`git remote add upstream https://github.com/usxs/simple-blog.git && git fetch upstream && git merge upstream/main`。

### 方式 A：连接 Git 仓库（需要你账号下的仓库）

1. 把仓库推到 GitHub（`frontend/` 与 `backend/` 在一起即可，Pages 只取它需要的目录）。
2. Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git**，选中仓库。
3. 构建配置：
   - Framework preset：`None`
   - Build command：留空
   - Build output directory：`frontend`
4. **Settings → Environment variables**（Production 与 Preview 都加）：

   | 变量 | 值 |
   | --- | --- |
   | `SITE_URL` | `https://www.example.com` |
   | `API_BASE_URL` | `https://api.example.com` |
   | `SITE_NAME` | `简单博客` |
   | `SITE_BIO` | 一句话站点简介 |

   > 改了环境变量需要重新部署一次才会生效。

5. 自定义域名填 `www.example.com`（以及把根域 `example.com` 301 到 `www`）。

部署完成后的自检：

```bash
curl -s https://www.example.com/ | head -20          # 首页
curl -s https://www.example.com/robots.txt
curl -s https://www.example.com/sitemap.xml | head  # 应看到 /post/<id> 真实路径
curl -s https://www.example.com/posts | grep '<title>'   # 应为「文章 · 简单博客」
```

### 方式 B：命令行上传（不需要 Fork）

```bash
npm i -g wrangler
wrangler pages deploy frontend --project-name simple-blog
```

`functions/` 必须一起上传，wrangler 会自动编译成边缘函数；直接拖拽静态文件不走 Functions，文章页就没有 SSR。

`sitemap.xml` 若返回的是首页 HTML，说明 Pages Functions 没生效：检查构建输出目录是否正确、`frontend/functions/` 目录是否被一起上传。

## 五、域名、SEO 与收录

1. DNS：`www` 指向 Pages（CNAME），`api` 指向服务器 IP；建议两者都开 Cloudflare 小云朵（后端请把 SSL 模式设为 **Full (strict)**）。
2. **Google Search Console**：添加资源时选择「网域」并用 DNS TXT 验证，这样 `www` 与 `api` 都在同一资源下；然后在「站点地图」提交 `https://www.example.com/sitemap.xml`。
   - 如果选的是「网址前缀」资源（`https://www.example.com`），那么提交 `api.example.com` 的 sitemap 会一直显示「无法读取」——这是 GSC 的资源隔离规则，不是服务端故障。
   - 提交后通常需要 1–2 天才会抓取，期间状态显示「已提交」是正常的。
3. **Bing Webmaster Tools**：可直接从 GSC 导入站点，再提交同一个 sitemap。
4. **IndexNow**（可选，但很划算）：
   两种配置方式，任选其一：
   - 后台：`https://api.example.com/admin.html` → 「管理 → 搜索引擎推送」，填入 `openssl rand -hex 16` 生成的密钥并保存；
   - 环境变量：在 `backend/.env` 里写 `INDEXNOW_KEY=<密钥>`。

   如果走后台，点「下载密钥文件」即可拿到 `<KEY>.txt`；两种方式都需要把这个文件（内容就是密钥本身）放到前端站点根目录（`frontend/`）一起部署，最后在后台点「检查密钥文件」确认能读到。之后每次发布 / 删除文章，后端都会通知 Bing/Yandex 重新抓取。

## 六、备份与迁移

### 方式一：后台一键备份（推荐）

后台「管理 → 备份」，点「立即备份并下载」：服务器把整个 `backend/`（代码 + 文章 + 图片 + 文件 + `data/`，不含 `node_modules`）打成 `<BACKUP_PREFIX><时间>-fe<前端版本>.tar.gz`，浏览器自动下载。同一份包也留在服务器上，列表里可以再次下载或删除。

同一张卡片里还能配自动备份和 WebDAV：

| 设置 | 说明 |
| --- | --- |
| 自动备份 | 打开后每天在指定时间（服务器本地时区，`HH:MM`）自动打包一次，页面关闭也不影响 |
| 保留份数 | 最近几份之外的旧包自动删除（1–50） |
| WebDAV | 填地址（如 `https://dav.example.com/`）、账号、密码、目录；「自动上传」打开后每次自动备份成功即传到网盘，「测试连接」可先探测目录 |
| 手动上传 | 备份列表里任选一份，点「上传到 WebDAV」 |

WebDAV 密码只存在服务器 `data/backup-settings.json`（0600），接口只回 `passwordSet: true`，不会回显明文。

每个包内除了 `backend/`，还带这几样：

| 文件 | 用途 |
| --- | --- |
| `manifest.json` | 生成时间、主机、后端文件数与大小、前端版本 / 分支 / commit |
| `frontend/` | 前端源码（能找到就近的 `前端/` 目录时）或首页 / CSS / JS / robots 的静态快照 |
| `restore.sh` | 一键恢复脚本，见下方 |
| `MIGRATION.md` | 迁移清单、nginx 反代示例、检查项 |
| `docker-compose.yml` + `.env.example` | 可移植的编排文件，相对路径挂载，改端口只动 `.env` |

前端版本号取自站点 `/version`，写进包名和 `manifest.json`。Cloudflare Pages 的 Functions 源码抓不到，这种情况包里会存静态快照并在 `frontend/SNAPSHOT.md` 里说明——前端要完整迁移，请另外保留 `前端/functions/` 的源码。

相关环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `BACKUP_DIR` | `data/backups` | 备份包存放目录，建议挂到宿主机 |
| `BACKUP_PREFIX` | `backup-` | 备份包文件名前缀，也是下载接口允许的包名前缀 |
| `BACKUP_KEEP` | `10` | 只保留最近几份，超出自动删旧的（1–50） |

### 一键迁移到新服务器

```bash
docker run --rm -v "$PWD":/w -w /w alpine tar xzf backup-*.tar.gz
cd backup-*/
./restore.sh --prepare-only     # 先体检：docker / compose / 磁盘 / 端口
sudo ./restore.sh               # 恢复，默认写入脚本内置的 BACKEND_DEPLOY_DIR（可用 TARGET_DIR 覆盖）
```

`restore.sh` 会：复制代码、把 `article Musings img file` 与 `config.json`、`data/` 铺到目标目录（已存在则跳过，加 `--force` 覆盖）、生成 `.env` 和 `docker-compose.yml`、`chown 1000:1000`、`docker compose up -d --build`，最后轮询健康检查。目标目录和端口可以改：

```bash
sudo TARGET_DIR=/srv/blog PORT=33002 ./restore.sh
```

### 方式二：手工打包

需要备份的只有六个路径：

```
backend/config.json
backend/article/
backend/Musings/
backend/img/
backend/file/
backend/data/          # auth.json、sessions.json、captcha-secret.json
```

```bash
cd simple-blog/backend
tar czf ~/blog-backup-$(date +%F).tar.gz config.json article Musings img file data
```

迁移到新机器：装好 Docker → 拷贝整个 `backend/`（含 `data/`）→ `chown -R 1000:1000` → `docker compose up -d --build`。所有会话、密码、文章、图片原样可用。

## 七、常见问题

| 现象 | 排查 |
| --- | --- |
| 容器起来又退出 | `docker compose logs` 看是否有 `EACCES`（目录权限）或端口占用 |
| `Conflict. The container name is already in use` | `docker rm -f simple-blog-backend` 后重新 `up -d` |
| 后台能进，前端文章 404 | `API_BASE_URL` 写错；浏览器 Network 里看 `/api/sync?module=posts` 的响应 |
| 上传图片报 500 或仍是 jpg | `docker compose logs` 里是否有 sharp 加载失败；重新 `--build` |
| 登录后刷新就退出 | Cookie 的 `SameSite=Strict` 要求前后端同站；如果前端在 `www.example.com`、后端在 `api.example.com`，属于同站（eTLD+1 相同），正常应可工作——检查浏览器是否有跨站拦截或第三方 Cookie 限制 |
| 评论提交后不显示 | 评论默认待审核，在后台「评论管理」里通过 |

> 若前端和后端不在同一个主域下（例如 `blog.pages.dev` + `api.example.com`），`SameSite=Strict` 的 Cookie 会被浏览器拦截，登录状态无法保持。请务必把前端绑到自有域名，并让前后端同属一个站点。
